"use client";

import { useState } from "react";

export default function DegreePlanner() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    if (selectedFile.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      setFile(null);
      setResult("");
      return;
    }

    setFile(selectedFile);
    setError("");
    setResult("");
  }

  async function analyzePDF() {
    if (!file) return;

    setLoading(true);
    setError("");
    setResult("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/analyze-degree", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      setResult(data.text);
    } catch {
      setError("Unable to analyze the PDF.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold text-gray-900">
          Smart Degree Planner
        </h1>

        <p className="mt-4 text-gray-600">
          Upload your DegreeWorks audit to help StudentDash understand your
          completed courses and remaining degree requirements.
        </p>

        <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-8">
          <label className="block text-lg font-semibold text-gray-900">
            Upload DegreeWorks PDF
          </label>

          <p className="mt-2 text-sm text-gray-500">
            Your degree audit must be in PDF format.
          </p>

          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="mt-6 block w-full rounded-lg border border-gray-300 p-3"
          />

          {error && (
            <p className="mt-4 text-sm text-red-600">
              {error}
            </p>
          )}

          {file && (
            <div className="mt-6 rounded-lg bg-gray-100 p-4">
              <p className="font-medium text-gray-900">
                Selected file:
              </p>

              <p className="mt-1 text-sm text-gray-600">
                {file.name}
              </p>

              <p className="mt-1 text-sm text-gray-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}

          <button
            onClick={analyzePDF}
            disabled={!file || loading}
            className="mt-6 rounded-lg bg-black px-6 py-3 text-white disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {loading ? "Analyzing..." : "Analyze Degree Audit"}
          </button>

          {result && (
            <div className="mt-8 rounded-xl border bg-gray-50 p-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Extracted Degree Audit Text
              </h2>

              <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap text-sm text-gray-700">
                {result}
              </pre>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}