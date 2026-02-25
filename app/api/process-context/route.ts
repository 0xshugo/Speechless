import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import OpenAI from "openai";

interface PromptConfig {
  system_prompt: string;
}

interface RequestBody {
  image: string;
  text: string;
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
  // Strip data URI prefix if present (e.g. "data:image/png;base64,...")
  const match = input.match(/^data:image\/[^;]+;base64,(.+)$/);
  return match ? match[1] : input;
}

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // Load system prompt from YAML
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

    // Parse request body
    const body: RequestBody = await request.json();

    if (!body.image || !body.text) {
      return NextResponse.json(
        { error: "Both 'image' and 'text' fields are required" },
        { status: 400 }
      );
    }

    const base64Image = normalizeBase64(body.image);

    // Call OpenAI API
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
            { type: "text", text: body.text },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
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
