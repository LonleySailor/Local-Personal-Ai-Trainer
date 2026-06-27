"use client";

import { useState, useRef, type FormEvent } from "react";

export default function ExerciseUpload({
  onUpload,
}: {
  onUpload?: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{
    type: "idle" | "loading" | "success" | "error";
    message?: string;
  }>({ type: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;

    setStatus({ type: "loading" });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/equipment/import", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        setStatus({ type: "error", message: json.error ?? "Upload failed" });
        return;
      }

      setStatus({
        type: "success",
        message: `Parsed ${json.parsed} rows, added ${json.added} new item(s).`,
      });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onUpload?.();
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Upload failed",
      });
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
    >
      <h2 className="text-xl font-semibold">Upload equipment CSV</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Expected columns: <code>name, category, weight, weight_unit</code>.
        Weight supports lists (&quot;5, 10, 15&quot;) or ranges (1-20). Unit
        accepts kg or lb.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm text-zinc-700 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white dark:text-zinc-300"
      />

      <button
        type="submit"
        disabled={!file || status.type === "loading"}
        className="rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status.type === "loading" ? "Uploading..." : "Import equipment"}
      </button>

      {status.type !== "idle" && status.type !== "loading" && status.message && (
        <p
          className={`text-sm ${
            status.type === "error" ? "text-red-600" : "text-green-600"
          }`}
        >
          {status.message}
        </p>
      )}
    </form>
  );
}
