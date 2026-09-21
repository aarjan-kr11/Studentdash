"use client";

import { useState } from "react";

type MorganCourse = {
  university: string;
  courseCode: string;
  sourceCourseCode: string;
  title: string;
  credits: number | null;

  prerequisiteText: string;
  prerequisitePaths: string[][];

  minimumGrade: string | null;
  offering: string | null;

  specialRequirements: string[];

  sourceUrl: string;
  catalogTerm: string | null;
  fetchedAt: string;
};

type LookupResult = {
  success: boolean;
  course: MorganCourse;
  cacheStatus: "hit" | "miss";
};

export default function CourseLookupPage() {
  const [courseCode, setCourseCode] =
    useState("INSS 391");

  const [result, setResult] =
    useState<LookupResult | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function lookupCourse() {
    if (!courseCode.trim()) {
      setError("Enter a course code.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(
        `/api/morgan-course?course=${encodeURIComponent(
          courseCode
        )}`
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "Course lookup failed."
        );

        return;
      }

      setResult(data);
    } catch (error) {
      console.error(error);

      setError(
        "StudentDash could not connect to the course lookup service."
      );
    } finally {
      setLoading(false);
    }
  }

  function prerequisiteLabel(
    path: string[]
  ) {
    return path.join(" AND ");
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}

      <nav className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <a
            href="/"
            className="text-2xl font-bold"
          >
            StudentDash
          </a>

          <span className="text-sm font-medium text-gray-500">
            Morgan Banner Course Test
          </span>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-6 py-14">
        {/* Heading */}

        <div className="max-w-3xl">
          <p className="font-semibold text-gray-500">
            Morgan Banner Test
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Course prerequisite lookup
          </h1>

          <p className="mt-4 text-lg leading-8 text-gray-600">
            Test whether StudentDash can retrieve
            course and prerequisite information
            from Morgan State University&apos;s
            public Banner catalog.
          </p>
        </div>

        {/* Search */}

        <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <label
            htmlFor="course"
            className="text-sm font-semibold text-gray-700"
          >
            Morgan course
          </label>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              id="course"
              type="text"
              value={courseCode}
              onChange={(event) =>
                setCourseCode(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter"
                ) {
                  lookupCourse();
                }
              }}
              placeholder="INSS 391"
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
            />

            <button
              onClick={lookupCourse}
              disabled={loading}
              className="rounded-xl bg-black px-6 py-3 font-medium text-white transition hover:bg-gray-800 disabled:bg-gray-300"
            >
              {loading
                ? "Checking Banner..."
                : "Look Up Course"}
            </button>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-700">
                {error}
              </p>
            </div>
          )}
        </section>

        {/* Results */}

        {result && (
          <div className="mt-8 space-y-6">
            {/* Main course */}

            <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <div className="flex flex-col justify-between gap-5 sm:flex-row">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    {
                      result.course
                        .university
                    }
                  </p>

                  <h2 className="mt-2 text-3xl font-bold">
                    {
                      result.course
                        .courseCode
                    }
                  </h2>

                  <p className="mt-2 text-lg text-gray-600">
                    {
                      result.course
                        .title
                    }
                  </p>

                  {result.course
                    .sourceCourseCode !==
                    result.course
                      .courseCode && (
                    <p className="mt-2 text-sm text-gray-400">
                      Banner code:{" "}
                      {
                        result.course
                          .sourceCourseCode
                      }
                    </p>
                  )}
                </div>

                <div>
                  <span className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium">
                    {result.cacheStatus ===
                    "hit"
                      ? "Cache hit"
                      : "Fetched from Banner"}
                  </span>
                </div>
              </div>
            </section>

            {/* Summary */}

            <section className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">
                  Credits
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {result.course
                    .credits ?? "—"}
                </p>
              </div>

              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">
                  Minimum Grade
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {result.course
                    .minimumGrade ??
                    "—"}
                </p>
              </div>

              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">
                  Catalog Term
                </p>

                <p className="mt-2 text-xl font-bold">
                  {result.course
                    .catalogTerm ??
                    "—"}
                </p>
              </div>
            </section>

            {/* Prerequisites */}

            <section className="rounded-2xl border bg-white p-8 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Prerequisites
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                Requirement structure
              </h2>

              {result.course
                .prerequisitePaths
                .length > 0 ? (
                <div className="mt-6 space-y-4">
                  {result.course.prerequisitePaths.map(
                    (path, index) => (
                      <div
                        key={index}
                      >
                        {index > 0 && (
                          <p className="mb-3 font-bold text-gray-400">
                            OR
                          </p>
                        )}

                        <div className="rounded-xl bg-gray-50 p-5">
                          <p className="font-semibold">
                            {prerequisiteLabel(
                              path
                            )}
                          </p>

                          {result.course
                            .minimumGrade && (
                            <p className="mt-2 text-sm text-gray-500">
                              Minimum grade:{" "}
                              {
                                result.course
                                  .minimumGrade
                              }
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div className="mt-6 rounded-xl bg-green-50 p-5">
                  <p className="font-semibold text-green-800">
                    No standard course
                    prerequisite detected.
                  </p>
                </div>
              )}

              <div className="mt-6 rounded-xl border p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Banner prerequisite text
                </p>

                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {
                    result.course
                      .prerequisiteText
                  }
                </p>
              </div>
            </section>

            {/* Special requirements */}

            {result.course
              .specialRequirements
              .length > 0 && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-8">
                <h2 className="text-xl font-bold">
                  Special Requirements
                </h2>

                <div className="mt-4 space-y-3">
                  {result.course.specialRequirements.map(
                    (
                      requirement,
                      index
                    ) => (
                      <p
                        key={index}
                        className="rounded-xl bg-white p-4 text-sm"
                      >
                        ⚠{" "}
                        {
                          requirement
                        }
                      </p>
                    )
                  )}
                </div>
              </section>
            )}

            {/* Offering */}

            <section className="rounded-2xl border bg-white p-8 shadow-sm">
              <h2 className="text-xl font-bold">
                Course Information
              </h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-gray-500">
                    Offering
                  </p>

                  <p className="mt-1 font-semibold">
                    {result.course
                      .offering ??
                      "Not specified"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">
                    Retrieved
                  </p>

                  <p className="mt-1 font-semibold">
                    {new Date(
                      result.course
                        .fetchedAt
                    ).toLocaleString()}
                  </p>
                </div>
              </div>
            </section>

            {/* Source */}

            <section className="rounded-2xl border bg-white p-8 shadow-sm">
              <h2 className="text-xl font-bold">
                Official Source
              </h2>

              <p className="mt-3 text-sm text-gray-600">
                This information was
                retrieved from Morgan
                State University&apos;s
                public Banner catalog.
              </p>

              <a
                href={
                  result.course
                    .sourceUrl
                }
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block font-semibold underline"
              >
                Open Morgan Banner record
              </a>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}