import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import OpenAI from "openai";

interface PromptConfig {
  system_prompt: string;
}

function loadSystemPrompt(): string {
  const filePath = path.join(process.cwd(), "config", "prompt.yaml");
  const raw = fs.readFileSync(filePath, "utf-8");
  const config = yaml.load(raw) as PromptConfig;

  if (!config?.system_prompt) {
    throw new Error("system_prompt field is missing in prompt.yaml");
  }

  return config.system_prompt;
}

function normalizeBase64(input: string): string {
  const match = input.match(/^data:image\/[^;]+;base64,(.+)$/);
  return match ? match[1] : input;
}

async function parseRequest(
  request: NextRequest
): Promise<{ image: string; text: string }> {
  const contentType = request.headers.get("content-type") ?? "";

  // Handle multipart/form-data (Apple Shortcuts)
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const imageField = formData.get("image");
    const text = formData.get("text") as string | null;

    let image = "";
    if (imageField instanceof File) {
      const buffer = Buffer.from(await imageField.arrayBuffer());
      image = buffer.toString("base64");
    } else if (typeof imageField === "string") {
      image = imageField;
    }

    return { image, text: text ?? "" };
  }

  // Handle application/x-www-form-urlencoded (Shortcuts "Form" mode)
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    const image = (formData.get("image") as string) ?? "";
    const text = (formData.get("text") as string) ?? "";
    return { image, text };
  }

  // Handle application/json (default)
  const body = await request.json();
  return { image: body.image ?? "", text: body.text ?? "" };
}

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    let systemPrompt: string;
    try {
      systemPrompt = loadSystemPrompt();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown YAML error";
      return NextResponse.json(
        { error: `Failed to load prompt config: ${message}` },
        { status: 500 }
      );
    }

    const { image, text } = await parseRequest(request);

    if (!image || !text) {
      return NextResponse.json(
        { error: "Both 'image' and 'text' fields are required" },
        { status: 400 }
      );
    }

    const base64Image = normalizeBase64(image);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            { type: "text", text },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "low",
              },
            },
          ],
        },
      ],
    });

    const result = completion.choices[0]?.message?.content ?? "";

    return NextResponse.json({ result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal server error";
    console.error("process-context error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
