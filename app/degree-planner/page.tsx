"use client";

import { useState } from "react";

type Course = {
  code: string;
  title: string;
  credits: number;
  term: string;
};

type RequiredCourse = {
  display: string;
  options: string[];
};

type AuditResult = {
  success: boolean;

  student: {
    degree: string;
    major: string;
    catalogYear: string;
  };

  academicSummary: {
    degreeProgress: number;
    requirementsProgress: number;
    gpa: string;
    creditsRequired: number;
    creditsApplied: number;
    creditsRemaining: number;
    generalEducationCreditsRemaining: number;
  };

  inProgress: {
    credits: number;
    courses: Course[];
  };

  remainingRequirements: {
    majorCourses: RequiredCourse[];
    businessCourses: RequiredCourse[];
  };

  rawText: string;
};

export default function DegreePlanner() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] =
    useState<AuditResult | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const selectedFile = event.target.files?.[0];

    setResult(null);
    setError("");

    if (!selectedFile) {
      setFile(null);
      return;
    }

    if (selectedFile.type !== "application/pdf") {
      setFile(null);
      setError("Please select a PDF file.");
      return;
    }

    setFile(selectedFile);
  }

  async function analyzeDegreeAudit() {
    if (!file) {
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        "/api/analyze-degree",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "StudentDash could not analyze this PDF."
        );

        return;
      }

      setResult(data);
    } catch (error) {
      console.error(error);

      setError(
        "Something went wrong while analyzing the PDF."
      );
    } finally {
      setLoading(false);
    }
  }

  function resetPlanner() {
    setFile(null);
    setResult(null);
    setError("");
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}

      <nav className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <a
            href="/"
            className="text-2xl font-bold"
          >
            StudentDash
          </a>

          <span className="text-sm font-medium text-gray-500">
            Smart Degree Planner
          </span>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Page heading */}

        <div className="max-w-3xl">
          <p className="font-semibold text-gray-500">
            Degree Planning
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Understand your degree progress.
          </h1>

          <p className="mt-4 text-lg leading-8 text-gray-600">
            Upload your DegreeWorks audit and
            StudentDash will organize your academic
            progress, current courses, and remaining
            requirements.
          </p>
        </div>

        {/* Upload */}

        <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div>
            <h2 className="text-xl font-semibold">
              Upload DegreeWorks Audit
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Upload the PDF version of your latest
              degree audit.
            </p>
          </div>

          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="mt-6 block w-full rounded-xl border border-gray-300 bg-gray-50 p-4 text-sm"
          />

          {file && (
            <div className="mt-5 rounded-xl bg-gray-50 p-4">
              <p className="text-sm font-semibold">
                Selected file
              </p>

              <p className="mt-1 text-sm text-gray-600">
                {file.name}
              </p>

              <p className="mt-1 text-xs text-gray-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-700">
                {error}
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={analyzeDegreeAudit}
              disabled={!file || loading}
              className="rounded-xl bg-black px-6 py-3 font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {loading
                ? "Analyzing Degree Audit..."
                : "Analyze Degree Audit"}
            </button>

            {(file || result) && (
              <button
                onClick={resetPlanner}
                className="rounded-xl border border-gray-300 px-6 py-3 font-medium transition hover:bg-gray-50"
              >
                Reset
              </button>
            )}
          </div>
        </section>

        {/* Results */}

        {result && (
          <div className="mt-10 space-y-8">
            {/* Degree information */}

            <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Degree
              </p>

              <h2 className="mt-2 text-3xl font-bold">
                {result.student.major ||
                  "Major not detected"}
              </h2>

              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
                <span>
                  {result.student.degree ||
                    "Degree unavailable"}
                </span>

                {result.student.catalogYear && (
                  <span>
                    Catalog:{" "}
                    {result.student.catalogYear}
                  </span>
                )}
              </div>
            </section>

            {/* Summary cards */}

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">
                  Degree Progress
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {
                    result.academicSummary
                      .degreeProgress
                  }
                  %
                </p>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-black"
                    style={{
                      width: `${Math.min(
                        result.academicSummary
                          .degreeProgress,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">
                  GPA
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {result.academicSummary.gpa ||
                    "—"}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">
                  Credits Applied
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {
                    result.academicSummary
                      .creditsApplied
                  }
                  <span className="text-lg font-normal text-gray-400">
                    {" "}
                    /{" "}
                    {
                      result.academicSummary
                        .creditsRequired
                    }
                  </span>
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">
                  Credits Remaining
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {
                    result.academicSummary
                      .creditsRemaining
                  }
                </p>
              </div>
            </section>

            {/* Current courses */}

            <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Current Semester
                  </p>

                  <h2 className="mt-1 text-2xl font-bold">
                    In-Progress Courses
                  </h2>
                </div>

                <div className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium">
                  {result.inProgress.credits} credits
                </div>
              </div>

              {result.inProgress.courses.length >
              0 ? (
                <div className="mt-6 divide-y">
                  {result.inProgress.courses.map(
                    (course) => (
                      <div
                        key={`${course.code}-${course.term}`}
                        className="flex flex-col justify-between gap-2 py-4 sm:flex-row sm:items-center"
                      >
                        <div>
                          <p className="font-semibold">
                            {course.code}
                          </p>

                          <p className="mt-1 text-sm text-gray-500">
                            {course.title}
                          </p>
                        </div>

                        <div className="text-sm text-gray-500 sm:text-right">
                          <p>
                            {course.credits} credits
                          </p>

                          <p>{course.term}</p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <p className="mt-6 text-gray-500">
                  No in-progress courses were detected.
                </p>
              )}
            </section>

            {/* Remaining requirements */}

            <div className="grid gap-8 lg:grid-cols-2">
              {/* Major */}

              <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Major Requirements
                </p>

                <h2 className="mt-1 text-2xl font-bold">
                  Remaining Major Courses
                </h2>

                {result.remainingRequirements
                  .majorCourses.length > 0 ? (
                  <div className="mt-6 space-y-3">
                    {result.remainingRequirements.majorCourses.map(
                      (course) => (
                        <div
                          key={course.display}
                          className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-4"
                        >
                          <span className="font-semibold">
                            {course.display}
                          </span>

                          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-500">
                            Required
                          </span>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <p className="mt-6 text-gray-500">
                    No remaining major courses were
                    detected.
                  </p>
                )}
              </section>

              {/* Business */}

              <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Supporting Requirements
                </p>

                <h2 className="mt-1 text-2xl font-bold">
                  Business & Core Courses
                </h2>

                {result.remainingRequirements
                  .businessCourses.length > 0 ? (
                  <div className="mt-6 space-y-3">
                    {result.remainingRequirements.businessCourses.map(
                      (course) => (
                        <div
                          key={course.display}
                          className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-4"
                        >
                          <span className="font-semibold">
                            {course.display}
                          </span>

                          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-500">
                            Required
                          </span>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <p className="mt-6 text-gray-500">
                    No remaining business/core courses
                    were detected.
                  </p>
                )}
              </section>
            </div>

            {/* Other requirements */}

            <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                General Education
              </p>

              <h2 className="mt-1 text-2xl font-bold">
                Other Outstanding Requirements
              </h2>

              <div className="mt-6 rounded-xl bg-gray-50 p-5">
                <p className="font-semibold">
                  General Education
                </p>

                <p className="mt-2 text-sm text-gray-600">
                  DegreeWorks reports{" "}
                  <strong>
                    {
                      result.academicSummary
                        .generalEducationCreditsRemaining
                    }{" "}
                    credits
                  </strong>{" "}
                  still remaining in this area.
                </p>
              </div>
            </section>

            {/* Planner notice */}

            <section className="rounded-2xl border border-gray-300 bg-white p-8">
              <h2 className="text-xl font-bold">
                Next: Smart Semester Planning
              </h2>

              <p className="mt-3 leading-7 text-gray-600">
                StudentDash has identified what your
                degree audit says you still need. It
                has not yet determined which courses
                you are eligible to take next.
              </p>

              <p className="mt-3 leading-7 text-gray-600">
                The next phase will combine these
                requirements with official course
                prerequisite information before
                recommending future semesters.
              </p>
            </section>

            {/* Raw data debugging */}

            <details className="rounded-2xl border border-gray-200 bg-white p-6">
              <summary className="cursor-pointer font-semibold">
                View extracted DegreeWorks text
              </summary>

              <pre className="mt-5 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-5 text-xs text-gray-600">
                {result.rawText}
              </pre>
            </details>
          </div>
        )}
      </div>
    </main>
  );
}