import { NextResponse } from "next/server";
import {
  getMorganCourse,
  MorganCourse,
} from "@/lib/morganCourse";

export const runtime = "nodejs";

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

type Verification =
  | "verified"
  | "tentative"
  | "choice";

type PlannerNode = {
  id: string;

  courseCode: string | null;

  title: string;

  area: string;

  requirementName: string;

  credits: number;

  creditsEstimated: boolean;

  requiredByDegree: boolean;

  prerequisiteOnly: boolean;

  choiceRequirement: boolean;

  choiceOptions: string[];

  verification: Verification;

  prerequisiteText: string;

  dependencies: string[];

  offering: string | null;

  warning: string | null;
};

type SemesterCourse = {
  id: string;

  courseCode: string | null;

  title: string;

  credits: number;

  creditsEstimated: boolean;

  prerequisiteOnly: boolean;

  choiceRequirement: boolean;

  choiceOptions: string[];

  verification: Verification;

  warning: string | null;
};

type Semester = {
  name: string;

  term: string;

  year: number;

  creditLimit: number;

  credits: number;

  courses: SemesterCourse[];
};

const CANONICAL_ALIASES:
  Record<string, string> = {
  "MGMT 324": "MGBU 324",
  "BUAD 324": "MGBU 324",

  "BUAD 326": "MGBU 326",

  "BUAD 327": "MGBU 327",

  "BUAD 381": "MGBU 381",

  "BUAD 498": "MGBU 498",

  "BUAD 499": "MGBU 499",

  "MGMT 328": "SSCM 328",

  "INSS 220": "SSCM 220",
};

function normalizeCourseCode(
  value: string
) {
  const match = value
    .toUpperCase()
    .replace(/\./g, "")
    .replace(/\s+/g, "")
    .match(
      /^([A-Z]{2,6})(\d{3}[A-Z]{0,2})$/
    );

  if (!match) {
    return value
      .trim()
      .toUpperCase();
  }

  return `${match[1]} ${match[2]}`;
}

function canonicalize(
  value: string
) {
  const normalized =
    normalizeCourseCode(value);

  return (
    CANONICAL_ALIASES[
      normalized
    ] ?? normalized
  );
}

function isRangeOption(
  value: string
) {
  return /\d{3}:\d{3}$/.test(
    value
  );
}

function courseNumber(
  courseCode: string | null
) {
  if (!courseCode) {
    return 0;
  }

  const match =
    courseCode.match(
      /(\d{3})/
    );

  return match
    ? Number(match[1])
    : 0;
}

function sameSubject(
  first: string,
  second: string
) {
  return (
    first.split(" ")[0] ===
    second.split(" ")[0]
  );
}

function suggestCourseForRequirement(
  requirement: Requirement,
  satisfied: Set<string>
) {
  const exactOptions =
    requirement.options.filter(
      (option) =>
        !isRangeOption(option)
    );

  /*
    Only one possible course.
  */
  if (
    requirement.options.length ===
      1 &&
    exactOptions.length === 1
  ) {
    return exactOptions[0];
  }

  /*
    Small same-subject alternatives.

    Example:
    MGBU 499 or MGBU 498

    We default to DegreeWorks' first
    listed option for the initial plan.
  */
  if (
    exactOptions.length > 0 &&
    exactOptions.length <= 2 &&
    exactOptions.length ===
      requirement.options.length &&
    exactOptions.every((option) =>
      sameSubject(
        option,
        exactOptions[0]
      )
    )
  ) {
    return exactOptions[0];
  }

  /*
    Example:
    Student already completed SPAN 101.

    DegreeWorks allows SPAN 102:499.

    StudentDash can reasonably suggest
    SPAN 102 as the continuation.
  */
  for (const option of requirement.options) {
    const range =
      option.match(
        /^([A-Z]{2,6})\s+(\d{3}):(\d{3})$/
      );

    if (!range) {
      continue;
    }

    const subject =
      range[1];

    const lower =
      Number(range[2]);

    const previous =
      `${subject} ${String(
        lower - 1
      ).padStart(3, "0")}`;

    if (
      satisfied.has(
        canonicalize(previous)
      )
    ) {
      return `${subject} ${range[2]}`;
    }
  }

  return null;
}

function choosePrerequisitePath(
  course: MorganCourse,
  satisfied: Set<string>,
  degreeTargets: Set<string>
) {
  if (
    course.prerequisitePaths.length ===
    0
  ) {
    return [];
  }

  let bestPath: string[] = [];

  let bestScore =
    Number.POSITIVE_INFINITY;

  for (const rawPath of course.prerequisitePaths) {
    const path =
      rawPath.map(
        canonicalize
      );

    let missing = 0;
    let unrelated = 0;

    for (const prerequisite of path) {
      if (
        satisfied.has(
          prerequisite
        )
      ) {
        continue;
      }

      missing++;

      if (
        !degreeTargets.has(
          prerequisite
        )
      ) {
        unrelated++;
      }
    }

    const score =
      missing * 100 +
      unrelated;

    if (score < bestScore) {
      bestScore = score;
      bestPath = path;
    }
  }

  return bestPath;
}

function offeringAllows(
  offering: string | null,
  term: string
) {
  if (!offering) {
    return true;
  }

  const upper =
    offering.toUpperCase();

  if (
    upper.includes(
      "OFFERED AS NEEDED"
    ) ||
    upper.includes("TBD")
  ) {
    return true;
  }

  return upper.includes(term);
}

function parseTerm(value: string) {
  const match = value.match(
    /(FALL|SPRING|SUMMER|WINTER(?:\s+MINI-MESTER)?)\s+(\d{4})/i
  );

  if (!match) {
    return null;
  }

  const term = match[1]
    .toUpperCase()
    .startsWith("WINTER")
    ? "WINTER"
    : match[1].toUpperCase();

  return {
    term,
    year: Number(match[2]),
  };
}

function firstFutureTerm(
  current:
    | {
        term: string;
        year: number;
      }
    | null,
  includeSummer: boolean,
  includeWinter: boolean
) {
  if (!current) {
    return {
      term: "SPRING",
      year:
        new Date().getFullYear() +
        1,
    };
  }

  if (current.term === "FALL") {
    if (includeWinter) {
      return {
        term: "WINTER",
        year:
          current.year + 1,
      };
    }

    return {
      term: "SPRING",
      year:
        current.year + 1,
    };
  }

  if (current.term === "WINTER") {
    return {
      term: "SPRING",
      year: current.year,
    };
  }

  if (current.term === "SPRING") {
    if (includeSummer) {
      return {
        term: "SUMMER",
        year: current.year,
      };
    }

    return {
      term: "FALL",
      year: current.year,
    };
  }

  return {
    term: "FALL",
    year: current.year,
  };
}

function nextTerm(
  current: {
    term: string;
    year: number;
  },
  includeSummer: boolean,
  includeWinter: boolean
) {
  if (current.term === "FALL") {
    if (includeWinter) {
      return {
        term: "WINTER",
        year:
          current.year + 1,
      };
    }

    return {
      term: "SPRING",
      year:
        current.year + 1,
    };
  }

  if (current.term === "WINTER") {
    return {
      term: "SPRING",
      year: current.year,
    };
  }

  if (current.term === "SPRING") {
    if (includeSummer) {
      return {
        term: "SUMMER",
        year: current.year,
      };
    }

    return {
      term: "FALL",
      year: current.year,
    };
  }

  return {
    term: "FALL",
    year: current.year,
  };
}

function semesterName(
  term: string,
  year: number
) {
  const display =
    term.charAt(0) +
    term
      .slice(1)
      .toLowerCase();

  return `${display} ${year}`;
}

function creditLimitForTerm(
  term: string,
  regularMax: number
) {
  if (
    term === "SUMMER" ||
    term === "WINTER"
  ) {
    return Math.min(
      regularMax,
      6
    );
  }

  return regularMax;
}

function tentativeDelay(
  node: PlannerNode
) {
  if (
    node.verification !==
    "tentative"
  ) {
    return 0;
  }

  const level =
    courseNumber(
      node.courseCode
    );

  if (level >= 490) {
    return 2;
  }

  if (level >= 400) {
    return 1;
  }

  return 0;
}

function plannerPriority(
  node: PlannerNode
) {
  let score = 0;

  if (node.prerequisiteOnly) {
    score -= 1000;
  }

  if (
    node.verification ===
    "verified"
  ) {
    score -= 300;
  }

  if (
    node.choiceRequirement
  ) {
    score += 50;
  }

  if (
    node.verification ===
    "tentative"
  ) {
    score += 200;
  }

  score +=
    courseNumber(
      node.courseCode
    );

  return score;
}

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const requirements =
      (body.requirements ??
        []) as Requirement[];

    const completedCourses =
      (body.completedCourses ??
        []) as string[];

    const inProgress =
      (body.inProgress ??
        []) as InProgressCourse[];

    const maxCredits =
      Math.max(
        6,
        Math.min(
          21,
          Number(
            body.maxCredits
          ) || 15
        )
      );

    const includeSummer =
      body.includeSummer !== false;

    const includeWinter =
      body.includeWinter === true;

    if (
      requirements.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "No outstanding DegreeWorks course requirements were found.",
        },
        {
          status: 400,
        }
      );
    }

    const completed =
      new Set<string>();

    for (const course of completedCourses) {
      completed.add(
        canonicalize(course)
      );
    }

    const inProgressSet =
      new Set<string>();

    for (const course of inProgress) {
      inProgressSet.add(
        canonicalize(
          course.courseCode
        )
      );
    }

    const satisfied =
      new Set<string>([
        ...completed,
        ...inProgressSet,
      ]);

    const degreeTargets =
      new Set<string>();

    const requirementSelections =
      requirements.map(
        (requirement) => {
          const selected =
            suggestCourseForRequirement(
              requirement,
              satisfied
            );

          if (selected) {
            degreeTargets.add(
              canonicalize(
                selected
              )
            );
          }

          return {
            requirement,
            selected,
          };
        }
      );

    const nodes =
      new Map<
        string,
        PlannerNode
      >();

    const resolving =
      new Set<string>();

    async function resolveCourse(
      requestedCourseCode: string,
      requiredByDegree: boolean,
      area: string,
      requirementName: string
    ) {
      const requested =
        normalizeCourseCode(
          requestedCourseCode
        );

      const canonical =
        canonicalize(
          requested
        );

      /*
        IMPORTANT:

        If this was automatically added
        ONLY because another course says
        it is a prerequisite, don't add it
        if the student already completed
        or is currently completing it.

        This prevents things like INSS 141
        from being scheduled again.
      */
      if (
        !requiredByDegree &&
        satisfied.has(canonical)
      ) {
        return;
      }

      const existing =
        nodes.get(canonical);

      if (existing) {
        if (requiredByDegree) {
          existing.requiredByDegree =
            true;

          existing.prerequisiteOnly =
            false;

          existing.area = area;

          existing.requirementName =
            requirementName;
        }

        return;
      }

      if (
        resolving.has(canonical)
      ) {
        return;
      }

      resolving.add(canonical);

      const node: PlannerNode = {
        id: canonical,

        courseCode: requested,

        title: requested,

        area,

        requirementName,

        credits: 3,

        creditsEstimated: true,

        requiredByDegree,

        prerequisiteOnly:
          !requiredByDegree,

        choiceRequirement: false,

        choiceOptions: [],

        verification:
          "tentative",

        prerequisiteText: "",

        dependencies: [],

        offering: null,

        warning:
          "Prerequisite verification required.",
      };

      nodes.set(
        canonical,
        node
      );

      try {
        const { course } =
          await getMorganCourse(
            requested
          );

        node.title =
          course.title;

        node.credits =
          course.credits ?? 3;

        node.creditsEstimated =
          course.credits === null;

        node.verification =
          "verified";

        node.prerequisiteText =
          course.prerequisiteText;

        node.offering =
          course.offering;

        node.warning = null;

        const chosenPath =
          choosePrerequisitePath(
            course,
            satisfied,
            degreeTargets
          );

        for (const rawDependency of chosenPath) {
          const dependency =
            canonicalize(
              rawDependency
            );

          /*
            Already completed or currently
            in progress = prerequisite is
            satisfied.
          */
          if (
            satisfied.has(
              dependency
            )
          ) {
            continue;
          }

          if (
            !node.dependencies.includes(
              dependency
            )
          ) {
            node.dependencies.push(
              dependency
            );
          }

          await resolveCourse(
            dependency,
            false,
            "Added Prerequisite",
            `Prerequisite for ${requested}`
          );
        }
      } catch (error) {
        node.verification =
          "tentative";

        node.warning =
          error instanceof Error
            ? `Prerequisite verification required. ${error.message}`
            : "Prerequisite verification required.";
      } finally {
        resolving.delete(
          canonical
        );
      }
    }

    for (const selection of requirementSelections) {
      const {
        requirement,
        selected,
      } = selection;

      if (selected) {
        await resolveCourse(
          selected,
          true,
          requirement.area,
          requirement.name
        );

        continue;
      }

      const choiceId =
        `REQ:${requirement.id}`;

      nodes.set(
        choiceId,
        {
          id: choiceId,

          courseCode: null,

          title:
            requirement.name,

          area:
            requirement.area,

          requirementName:
            requirement.name,

          /*
            Until the student chooses an
            exact class, use 3 credits for
            planning capacity only.

            UI clearly labels it estimated.
          */
          credits: 3,

          creditsEstimated: true,

          requiredByDegree: true,

          prerequisiteOnly: false,

          choiceRequirement: true,

          choiceOptions:
            requirement.options,

          verification:
            "choice",

          prerequisiteText:
            requirement.rawText,

          dependencies: [],

          offering: null,

          warning: null,
        }
      );
    }

    let latestCurrentTerm:
      | {
          term: string;
          year: number;
        }
      | null = null;

    for (const course of inProgress) {
      const parsed =
        parseTerm(
          course.term
        );

      if (!parsed) {
        continue;
      }

      if (
        !latestCurrentTerm ||
        parsed.year >
          latestCurrentTerm.year
      ) {
        latestCurrentTerm =
          parsed;
      }
    }

    let currentTerm =
      firstFutureTerm(
        latestCurrentTerm,
        includeSummer,
        includeWinter
      );

    const scheduledIds =
      new Set<string>();

    const satisfiedBeforeTerm =
      new Set<string>(
        satisfied
      );

    const semesters:
      Semester[] = [];

    for (
      let semesterIndex = 0;
      semesterIndex < 18;
      semesterIndex++
    ) {
      const termLimit =
        creditLimitForTerm(
          currentTerm.term,
          maxCredits
        );

      const candidates =
        [...nodes.values()]
          .filter((node) => {
            if (
              scheduledIds.has(
                node.id
              )
            ) {
              return false;
            }

            if (
              semesterIndex <
              tentativeDelay(
                node
              )
            ) {
              return false;
            }

            if (
              !offeringAllows(
                node.offering,
                currentTerm.term
              )
            ) {
              return false;
            }

            return node.dependencies.every(
              (dependency) =>
                satisfiedBeforeTerm.has(
                  dependency
                )
            );
          })
          .sort(
            (a, b) =>
              plannerPriority(a) -
              plannerPriority(b)
          );

      if (
        candidates.length === 0
      ) {
        if (
          scheduledIds.size >=
          nodes.size
        ) {
          break;
        }

        currentTerm =
          nextTerm(
            currentTerm,
            includeSummer,
            includeWinter
          );

        continue;
      }

      let credits = 0;

      const semesterCourses:
        SemesterCourse[] =
          [];

      for (const node of candidates) {
        const courseCredits =
          node.credits || 3;

        if (
          credits +
            courseCredits >
          termLimit
        ) {
          continue;
        }

        semesterCourses.push({
          id: node.id,

          courseCode:
            node.courseCode,

          title:
            node.title,

          credits:
            courseCredits,

          creditsEstimated:
            node.creditsEstimated,

          prerequisiteOnly:
            node.prerequisiteOnly,

          choiceRequirement:
            node.choiceRequirement,

          choiceOptions:
            node.choiceOptions,

          verification:
            node.verification,

          warning:
            node.warning,
        });

        credits +=
          courseCredits;
      }

      if (
        semesterCourses.length ===
        0
      ) {
        currentTerm =
          nextTerm(
            currentTerm,
            includeSummer,
            includeWinter
          );

        continue;
      }

      semesters.push({
        name:
          semesterName(
            currentTerm.term,
            currentTerm.year
          ),

        term:
          currentTerm.term,

        year:
          currentTerm.year,

        creditLimit:
          termLimit,

        credits,

        courses:
          semesterCourses,
      });

      /*
        Mark this semester as completed
        only AFTER all courses for the
        term have been chosen.

        That prevents a prerequisite and
        dependent course being placed in
        the same semester.
      */
      for (const course of semesterCourses) {
        scheduledIds.add(
          course.id
        );
      }

      for (const course of semesterCourses) {
        if (
          course.courseCode
        ) {
          satisfiedBeforeTerm.add(
            canonicalize(
              course.courseCode
            )
          );
        }
      }

      currentTerm =
        nextTerm(
          currentTerm,
          includeSummer,
          includeWinter
        );
    }

    const unplaced =
      [...nodes.values()]
        .filter(
          (node) =>
            !scheduledIds.has(
              node.id
            )
        )
        .map((node) => ({
          courseCode:
            node.courseCode,

          title:
            node.title,

          reason:
            node.dependencies.length >
            0
              ? `Still waiting on prerequisite(s): ${node.dependencies.join(
                  ", "
                )}`
              : "Could not place this course within the generated planning window.",
        }));

    const allScheduled =
      semesters.flatMap(
        (semester) =>
          semester.courses
      );

    const plannedCredits =
      semesters.reduce(
        (total, semester) =>
          total +
          semester.credits,
        0
      );

    return NextResponse.json({
      success: true,

      summary: {
        degreeRequirementCount:
          requirements.reduce(
            (
              total,
              requirement
            ) =>
              total +
              requirement.choose,
            0
          ),

        plannedCredits,

        plannedCreditsIncludeEstimates:
          allScheduled.some(
            (course) =>
              course
                .creditsEstimated
          ),

        addedPrerequisites:
          allScheduled.filter(
            (course) =>
              course
                .prerequisiteOnly
          ).length,

        tentativeCourses:
          allScheduled.filter(
            (course) =>
              course.verification ===
              "tentative"
          ).length,

        choiceRequirements:
          allScheduled.filter(
            (course) =>
              course
                .choiceRequirement
          ).length,
      },

      semesters,

      unplaced,
    });
  } catch (error) {
    console.error(
      "Degree plan error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          "StudentDash could not build the degree plan.",
      },
      {
        status: 500,
      }
    );
  }
}