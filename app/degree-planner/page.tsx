"use client";

import { useState } from "react";

type Requirement = {
  id: string;
  area: string;
  name: string;
  choose: number;
  options: string[];
  rawText: string;
};

type InProgressCourse = {
  courseCode: string;
  title: string;
  credits: number;
  term: string;
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

    minimumCreditsTo120: number;

    outstandingCourseCount: number;

    knownRemainingRequirementCredits: number;

    hasVariableCreditRequirement: boolean;
  };

  completedCourses: string[];

  inProgress: InProgressCourse[];

  requirements: Requirement[];

  rawText: string;
};

type PlannedCourse = {
  id: string;

  courseCode: string | null;

  title: string;

  credits: number;

  creditsEstimated: boolean;

  prerequisiteOnly: boolean;

  choiceRequirement: boolean;

  choiceOptions: string[];

  verification:
    | "verified"
    | "tentative"
    | "choice";

  warning: string | null;
};

type Semester = {
  name: string;

  term: string;

  year: number;

  creditLimit: number;

  credits: number;

  courses: PlannedCourse[];
};

type PlanResult = {
  success: boolean;

  summary: {
    degreeRequirementCount: number;

    plannedCredits: number;

    plannedCreditsIncludeEstimates: boolean;

    addedPrerequisites: number;

    tentativeCourses: number;

    choiceRequirements: number;
  };

  semesters: Semester[];

  unplaced: {
    courseCode: string | null;
    title: string;
    reason: string;
  }[];
};

function compactOptions(
  options: string[]
) {
  return options.join(", ");
}

export default function DegreePlannerPage() {
  const [file, setFile] =
    useState<File | null>(
      null
    );

  const [audit, setAudit] =
    useState<AuditResult | null>(
      null
    );

  const [plan, setPlan] =
    useState<PlanResult | null>(
      null
    );

  const [
    analyzing,
    setAnalyzing,
  ] = useState(false);

  const [
    buildingPlan,
    setBuildingPlan,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [
    maxCredits,
    setMaxCredits,
  ] = useState(15);

  const [
    includeSummer,
    setIncludeSummer,
  ] = useState(true);

  const [
    includeWinter,
    setIncludeWinter,
  ] = useState(false);

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const selected =
      event.target.files?.[0];

    setError("");
    setAudit(null);
    setPlan(null);

    if (!selected) {
      setFile(null);
      return;
    }

    if (
      selected.type !==
      "application/pdf"
    ) {
      setFile(null);

      setError(
        "Please upload a PDF file."
      );

      return;
    }

    setFile(selected);
  }

  async function analyzeDegree() {
    if (!file) {
      return;
    }

    setAnalyzing(true);
    setError("");
    setAudit(null);
    setPlan(null);

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      const response =
        await fetch(
          "/api/analyze-degree",
          {
            method: "POST",
            body: formData,
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "DegreeWorks analysis failed."
        );

        return;
      }

      setAudit(data);
    } catch (error) {
      console.error(error);

      setError(
        "StudentDash could not analyze the PDF."
      );
    } finally {
      setAnalyzing(false);
    }
  }

  async function buildPlan() {
    if (!audit) {
      return;
    }

    setBuildingPlan(true);
    setPlan(null);
    setError("");

    try {
      const response =
        await fetch(
          "/api/build-degree-plan",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              requirements:
                audit.requirements,

              completedCourses:
                audit.completedCourses,

              inProgress:
                audit.inProgress,

              maxCredits,

              includeSummer,

              includeWinter,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "StudentDash could not build the degree plan."
        );

        return;
      }

      setPlan(data);
    } catch (error) {
      console.error(error);

      setError(
        "Something went wrong while building the degree plan."
      );
    } finally {
      setBuildingPlan(false);
    }
  }

  function resetPlanner() {
    setFile(null);
    setAudit(null);
    setPlan(null);
    setError("");
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
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
        <div className="max-w-3xl">
          <p className="font-semibold text-gray-500">
            DegreeWorks Planner
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Build your path to graduation.
          </h1>

          <p className="mt-4 text-lg leading-8 text-gray-600">
            Upload your DegreeWorks
            audit. StudentDash reads
            your remaining course
            requirements, checks
            prerequisites, and builds a
            semester plan.
          </p>
        </div>

        <section className="mt-10 rounded-2xl border bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold">
            Upload DegreeWorks
          </h2>

          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="mt-5 block w-full rounded-xl border bg-gray-50 p-4"
          />

          {file && (
            <div className="mt-4 rounded-xl bg-gray-50 p-4">
              <p className="font-medium">
                {file.name}
              </p>

              <p className="mt-1 text-sm text-gray-500">
                {(
                  file.size /
                  1024 /
                  1024
                ).toFixed(2)}{" "}
                MB
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={
                analyzeDegree
              }
              disabled={
                !file ||
                analyzing
              }
              className="rounded-xl bg-black px-6 py-3 font-medium text-white disabled:bg-gray-300"
            >
              {analyzing
                ? "Reading DegreeWorks..."
                : "Analyze Degree Audit"}
            </button>

            {(file ||
              audit ||
              plan) && (
              <button
                onClick={
                  resetPlanner
                }
                className="rounded-xl border px-6 py-3 font-medium"
              >
                Reset
              </button>
            )}
          </div>

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}
        </section>

        {audit && (
          <>
            <section className="mt-8 rounded-2xl border bg-white p-8 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Degree Audit
              </p>

              <h2 className="mt-2 text-3xl font-bold">
                {
                  audit.student
                    .major
                }
              </h2>

              <p className="mt-2 text-gray-600">
                {
                  audit.student
                    .degree
                }

                {audit.student
                  .catalogYear &&
                  ` • ${audit.student.catalogYear}`}
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-4">
                <div className="rounded-xl bg-gray-50 p-5">
                  <p className="text-sm text-gray-500">
                    Degree Progress
                  </p>

                  <p className="mt-2 text-3xl font-bold">
                    {
                      audit
                        .academicSummary
                        .degreeProgress
                    }
                    %
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 p-5">
                  <p className="text-sm text-gray-500">
                    GPA
                  </p>

                  <p className="mt-2 text-3xl font-bold">
                    {
                      audit
                        .academicSummary
                        .gpa
                    }
                  </p>
                </div>

                <div className="rounded-xl bg-black p-5 text-white">
                  <p className="text-sm text-gray-300">
                    Remaining Courses
                  </p>

                  <p className="mt-2 text-3xl font-bold">
                    {
                      audit
                        .academicSummary
                        .outstandingCourseCount
                    }
                  </p>

                  <p className="mt-2 text-xs text-gray-300">
                    course requirements
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 p-5">
                  <p className="text-sm text-gray-500">
                    Requirement Credits
                  </p>

                  <p className="mt-2 text-3xl font-bold">
                    {
                      audit
                        .academicSummary
                        .knownRemainingRequirementCredits
                    }
                    {audit
                      .academicSummary
                      .hasVariableCreditRequirement
                      ? "+"
                      : ""}
                  </p>

                  <p className="mt-2 text-xs text-gray-500">
                    {audit
                      .academicSummary
                      .hasVariableCreditRequirement
                      ? "Plus the University Requirement course"
                      : "Remaining requirement credits"}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
                Your audit also shows{" "}
                <strong>
                  {
                    audit
                      .academicSummary
                      .minimumCreditsTo120
                  }
                </strong>{" "}
                minimum credits to reach
                120 total credits. That
                number is separate from
                your actual remaining
                degree requirements.
              </div>
            </section>

            <section className="mt-8 rounded-2xl border bg-white p-8 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">
                    Remaining Requirements
                  </h2>

                  <p className="mt-2 text-gray-600">
                    StudentDash found{" "}
                    {
                      audit
                        .academicSummary
                        .outstandingCourseCount
                    }{" "}
                    remaining course
                    requirements.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {audit.requirements.map(
                  (
                    requirement
                  ) => (
                    <div
                      key={
                        requirement.id
                      }
                      className="rounded-xl border p-5"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold">
                          {
                            requirement.area
                          }
                        </span>

                        <p className="font-bold">
                          {
                            requirement.name
                          }
                        </p>
                      </div>

                      {requirement.options
                        .length ===
                      1 ? (
                        <p className="mt-3 text-sm font-semibold">
                          {
                            requirement
                              .options[0]
                          }
                        </p>
                      ) : (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-sm font-semibold">
                            Choose{" "}
                            {
                              requirement.choose
                            }{" "}
                            from{" "}
                            {
                              requirement
                                .options
                                .length
                            }{" "}
                            approved options
                          </summary>

                          <p className="mt-3 rounded-lg bg-gray-50 p-4 text-sm leading-6 text-gray-600">
                            {compactOptions(
                              requirement.options
                            )}
                          </p>
                        </details>
                      )}
                    </div>
                  )
                )}
              </div>
            </section>

            {audit.inProgress.length >
              0 && (
              <section className="mt-8 rounded-2xl border bg-white p-8 shadow-sm">
                <h2 className="text-xl font-bold">
                  Current Semester
                </h2>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {audit.inProgress.map(
                    (course) => (
                      <div
                        key={
                          course.courseCode
                        }
                        className="rounded-xl bg-gray-50 p-4"
                      >
                        <p className="font-bold">
                          {
                            course.courseCode
                          }
                        </p>

                        <p className="mt-1 text-sm text-gray-600">
                          {
                            course.title
                          }
                        </p>
                      </div>
                    )
                  )}
                </div>
              </section>
            )}

            <section className="mt-8 rounded-2xl border bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold">
                Build My Degree Plan
              </h2>

              <p className="mt-2 text-gray-600">
                Choose how you want
                StudentDash to spread
                your remaining courses.
              </p>

              <div className="mt-6 flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-sm font-semibold">
                    Fall / Spring maximum
                  </label>

                  <select
                    value={
                      maxCredits
                    }
                    onChange={(
                      event
                    ) =>
                      setMaxCredits(
                        Number(
                          event
                            .target
                            .value
                        )
                      )
                    }
                    className="mt-2 rounded-xl border px-4 py-3"
                  >
                    <option value={12}>
                      12 credits
                    </option>

                    <option value={15}>
                      15 credits
                    </option>

                    <option value={18}>
                      18 credits
                    </option>
                  </select>
                </div>

                <label className="flex items-center gap-3 rounded-xl border px-4 py-3">
                  <input
                    type="checkbox"
                    checked={
                      includeSummer
                    }
                    onChange={(
                      event
                    ) =>
                      setIncludeSummer(
                        event.target
                          .checked
                      )
                    }
                  />

                  <span className="font-medium">
                    Include Summer
                  </span>
                </label>

                <label className="flex items-center gap-3 rounded-xl border px-4 py-3">
                  <input
                    type="checkbox"
                    checked={
                      includeWinter
                    }
                    onChange={(
                      event
                    ) =>
                      setIncludeWinter(
                        event.target
                          .checked
                      )
                    }
                  />

                  <span className="font-medium">
                    Include Winter
                  </span>
                </label>

                <button
                  onClick={
                    buildPlan
                  }
                  disabled={
                    buildingPlan
                  }
                  className="rounded-xl bg-black px-7 py-3 font-semibold text-white disabled:bg-gray-300"
                >
                  {buildingPlan
                    ? "Building plan..."
                    : "Build My Degree Plan"}
                </button>
              </div>

              <p className="mt-4 text-sm text-gray-500">
                Summer and Winter are
                automatically limited to
                a maximum of 6 credits.
              </p>
            </section>
          </>
        )}

        {plan && (
          <div className="mt-10 space-y-7">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Degree Plan
              </p>

              <h2 className="mt-2 text-3xl font-bold">
                Recommended Schedule
              </h2>

              <p className="mt-2 text-gray-600">
                {
                  plan.summary
                    .degreeRequirementCount
                }{" "}
                degree requirements
                {plan.summary
                  .addedPrerequisites >
                  0 &&
                  ` + ${plan.summary.addedPrerequisites} added prerequisite${
                    plan.summary
                      .addedPrerequisites ===
                    1
                      ? ""
                      : "s"
                  }`}
              </p>
            </div>

            {plan.semesters.map(
              (semester) => (
                <section
                  key={
                    semester.name
                  }
                  className="rounded-2xl border bg-white p-7 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-2xl font-bold">
                      {
                        semester.name
                      }
                    </h3>

                    <span className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold">
                      {
                        semester.credits
                      }{" "}
                      /{" "}
                      {
                        semester.creditLimit
                      }{" "}
                      credits
                    </span>
                  </div>

                  <div className="mt-5 divide-y">
                    {semester.courses.map(
                      (course) => (
                        <div
                          key={
                            course.id
                          }
                          className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold">
                                {course.courseCode ??
                                  course.title}
                              </p>

                              {course.prerequisiteOnly && (
                                <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-800">
                                  Added
                                  prerequisite
                                </span>
                              )}

                              {course.verification ===
                                "tentative" && (
                                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                                  ⚠ Verify
                                  prereq
                                </span>
                              )}

                              {course.choiceRequirement && (
                                <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                                  Choose 1
                                </span>
                              )}
                            </div>

                            {course.courseCode && (
                              <p className="mt-1 text-sm text-gray-600">
                                {
                                  course.title
                                }
                              </p>
                            )}

                            {course.choiceRequirement && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-sm text-blue-700">
                                  View approved
                                  course options
                                </summary>

                                <p className="mt-2 max-w-3xl rounded-lg bg-blue-50 p-3 text-sm leading-6 text-blue-900">
                                  {compactOptions(
                                    course.choiceOptions
                                  )}
                                </p>
                              </details>
                            )}
                          </div>

                          <span className="text-sm text-gray-500">
                            {
                              course.credits
                            }{" "}
                            credits
                            {course
                              .creditsEstimated
                              ? " est."
                              : ""}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </section>
              )
            )}

            {plan.unplaced.length >
              0 && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7">
                <h2 className="text-xl font-bold">
                  Still Needs Placement
                </h2>

                <div className="mt-4 space-y-3">
                  {plan.unplaced.map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        key={
                          index
                        }
                        className="rounded-xl bg-white p-4"
                      >
                        <p className="font-bold">
                          {item.courseCode ??
                            item.title}
                        </p>

                        <p className="mt-1 text-sm text-gray-600">
                          {
                            item.reason
                          }
                        </p>
                      </div>
                    )
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}