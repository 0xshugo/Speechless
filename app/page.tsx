"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import s from "./page.module.css";

export default function Home() {
  const [image, setImage] = useState<string>("");
  const [preview, setPreview] = useState<string>("");
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      // Strip data URI prefix → pure base64
      setImage(dataUrl.replace(/^data:image\/[^;]+;base64,/, ""));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setResult("");
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/process-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Error ${res.status}`);
      } else {
        setResult(data.result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const endpoint = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className={s.page}>
      <header className={s.header}>
        <h1 className={s.title}>Speechless</h1>
        <p className={s.subtitle}>Vision Context BFF — Test Console</p>
      </header>

      <form className={s.card} onSubmit={handleSubmit}>
        <div className={s.field}>
          <label className={s.label}>Screenshot (image)</label>
          <input
            className={s.fileInput}
            type="file"
            accept="image/*"
            onChange={handleFile}
          />
          {preview && (
            <img src={preview} alt="preview" className={s.preview} />
          )}
        </div>

        <div className={s.field}>
          <label className={s.label}>Voice Input (text)</label>
          <textarea
            className={s.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="例: これを英語に翻訳して"
          />
        </div>

        <button
          className={s.button}
          type="submit"
          disabled={loading || !image || !text}
        >
          {loading ? "Processing..." : "Send"}
        </button>

        {result && (
          <div className={s.resultBox}>
            <div className={s.resultLabel}>Result</div>
            <div className={s.resultText}>{result}</div>
          </div>
        )}

        {error && (
          <div className={s.resultBox}>
            <div className={`${s.resultLabel} ${s.errorText}`}>Error</div>
            <div className={`${s.resultText} ${s.errorText}`}>{error}</div>
          </div>
        )}
      </form>

      <div className={s.endpoint}>
        <h2 className={s.endpointTitle}>API Endpoint</h2>
        <div className={s.codeBlock}>
{`POST ${endpoint}/api/process-context
Content-Type: application/json

{
  "image": "<base64 encoded image>",
  "text": "ユーザーの発話テキスト"
}

→ { "result": "生成されたテキスト" }`}
        </div>
      </div>
    </div>
  );
}
