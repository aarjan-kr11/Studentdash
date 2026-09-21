import { NextResponse } from "next/server";
import { getData } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";

PDFParse.setWorker(getData());

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

function cleanLine(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/\u00ad/g, "")
    .replace(/\uFFFE/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalizeCourseCode(value: string) {
  const match = value
    .toUpperCase()
    .replace(/\./g, "")
    .replace(/\s+/g, "")
    .match(/^([A-Z]{2,6})(\d{3}[A-Z]{0,2})$/);

  if (!match) {
    return value.trim().toUpperCase();
  }

  return `${match[1]} ${match[2]}`;
}

function getSection(
  text: string,
  startPattern: RegExp,
  endPattern?: RegExp
) {
  const start = text.search(startPattern);

  if (start === -1) {
    return "";
  }

  const afterStart = text.slice(start);

  if (!endPattern) {
    return afterStart;
  }

  const end = afterStart.search(endPattern);

  if (end === -1) {
    return afterStart;
  }

  return afterStart.slice(0, end);
}

function isSectionBarrier(line: string) {
  return (
    !line ||
    /^Course Title Grade Credits Term Repeated$/i.test(line) ||
    /^Morgan State University/i.test(line) ||
    /^-- \d+ of \d+ --$/i.test(line) ||
    /^Unmet conditions/i.test(line) ||
    /^In all instances/i.test(line) ||
    /^Credits required:/i.test(line)
  );
}

function looksLikeCourseRow(line: string) {
  return /\b[A-Z]{2,6}\s+\d{3}[A-Z]{0,2}\b.*\b(?:TRA|TRB|TRC|TRD|A\+|A-|A|B\+|B-|B|C\+|C-|C|D\+|D-|D|P|S|IP)\b/i.test(
    line
  );
}

function extractLabelBeforeCourse(line: string) {
  const match = line.match(
    /\b[A-Z]{2,6}\s+\d{3}[A-Z]{0,2}\b/
  );

  if (!match || match.index === undefined) {
    return "";
  }

  return line
    .slice(0, match.index)
    .trim();
}

/*
  IMPORTANT:
  A continuation line may look like:

  "or 119"

  or:

  "CHIN 102:499 or COMM 203"

  It must NOT treat a normal sentence such as:

  "Business Policy or Honors Still needed..."

  as a continuation of the previous requirement.
*/
function isCourseOptionContinuation(line: string) {
  const value = line.trim();

  if (!value) {
    return false;
  }

  if (/Still needed:/i.test(value)) {
    return false;
  }

  if (/^or\b/i.test(value)) {
    return true;
  }

  if (
    /^[A-Z]{2,6}\s+\d{3}(?::\d{3})?\b/i.test(
      value
    )
  ) {
    return true;
  }

  if (/^\d{3}(?::\d{3})?\b/.test(value)) {
    return true;
  }

  return false;
}

function parseCourseOptions(rawRequirement: string) {
  const afterClass = rawRequirement.replace(
    /^.*?\bClass(?:es)?\s+in\s+/i,
    ""
  );

  const options: string[] = [];

  let currentSubject = "";

  const pattern =
    /(?:\b([A-Z]{2,6})\s+)?(\d{3})(?::(\d{3}))?/g;

  for (const match of afterClass.matchAll(pattern)) {
    if (match[1]) {
      currentSubject = match[1].toUpperCase();
    }

    if (!currentSubject) {
      continue;
    }

    const lower = match[2];
    const upper = match[3];

    const option = upper
      ? `${currentSubject} ${lower}:${upper}`
      : `${currentSubject} ${lower}`;

    if (!options.includes(option)) {
      options.push(option);
    }
  }

  return options;
}

function extractRequirements(
  section: string,
  area: string
): Requirement[] {
  if (!section) {
    return [];
  }

  const lines = section
    .split("\n")
    .map(cleanLine)
    .filter(Boolean);

  const requirements: Requirement[] = [];

  let currentRequirementLabel = "";
  let pendingLabelParts: string[] = [];
  let insideSatisfiedBy = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    /*
      A new Still-needed requirement always
      exits a previous "Satisfied by" block.
    */
    const stillNeededIndex =
      line.indexOf("Still needed:");

    if (stillNeededIndex !== -1) {
      insideSatisfiedBy = false;

      const beforeStillNeeded = line
        .slice(0, stillNeededIndex)
        .trim();

      let requirementText = line
        .slice(
          stillNeededIndex +
            "Still needed:".length
        )
        .trim();

      /*
        We only want actual course requirements,
        not lines such as:

        "See Major section"
        "120 credits are required"
      */
      if (
        !/\d+\s+Class(?:es)?\s+in\s+/i.test(
          requirementText
        )
      ) {
        pendingLabelParts = [];
        continue;
      }

      let next = i + 1;

      while (
        next < lines.length &&
        isCourseOptionContinuation(lines[next])
      ) {
        requirementText += ` ${lines[next]}`;
        next++;
      }

      i = next - 1;

      let name = beforeStillNeeded;

      if (!name && pendingLabelParts.length > 0) {
        name = pendingLabelParts
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
      }

      if (!name && currentRequirementLabel) {
        name = currentRequirementLabel;
      }

      if (!name) {
        name = "Remaining Requirement";
      }

      const chooseMatch =
        requirementText.match(
          /(\d+)\s+Class(?:es)?\s+in/i
        );

      const choose = chooseMatch
        ? Number(chooseMatch[1])
        : 1;

      const options =
        parseCourseOptions(requirementText);

      if (options.length > 0) {
        requirements.push({
          id: `${area
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")}-${requirements.length + 1}`,

          area,

          name,

          choose,

          options,

          rawText: requirementText,
        });
      }

      pendingLabelParts = [];

      continue;
    }

    if (/^Satisfied by:/i.test(line)) {
      insideSatisfiedBy = true;
      continue;
    }

    /*
      Ignore transfer-source description
      lines after "Satisfied by:".
    */
    if (insideSatisfiedBy) {
      if (looksLikeCourseRow(line)) {
        insideSatisfiedBy = false;
      } else {
        continue;
      }
    }

    if (looksLikeCourseRow(line)) {
      const label =
        extractLabelBeforeCourse(line);

      if (label) {
        currentRequirementLabel = label;
      }

      pendingLabelParts = [];
      continue;
    }

    if (isSectionBarrier(line)) {
      pendingLabelParts = [];
      continue;
    }

    /*
      Ignore section titles themselves.
    */
    if (
      /^(University Requirements|General Education Program|Major .* INCOMPLETE|Business and Management Support and Core)/i.test(
        line
      )
    ) {
      pendingLabelParts = [];
      continue;
    }

    /*
      These are useful for multiline labels such as:

      Activity, Adulting, Financial Literacy, Mindfulness,
      or Discovering Student Identity
    */
    if (
      !/^Satisfied by/i.test(line) &&
      !/^Please note/i.test(line)
    ) {
      pendingLabelParts.push(line);

      if (pendingLabelParts.length > 4) {
        pendingLabelParts.shift();
      }
    }
  }

  return requirements;
}

function extractCompletedCourses(text: string) {
  const flat = text
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ");

  const completed =
    new Set<string>();

  const pattern =
    /\b([A-Z]{2,6})\s+(\d{3}[A-Z]{0,2})\b.{0,180}?\b(TRA|TRB|TRC|TRD|A\+|A-|A|B\+|B-|B|C\+|C-|C|D\+|D-|D|P|S)\b\s+(\d+(?:\.\d+)?)\s+(FALL|SPRING|SUMMER|WINTER(?:\s+MINI-MESTER)?)\s+(\d{4})/g;

  for (const match of flat.matchAll(pattern)) {
    completed.add(
      normalizeCourseCode(
        `${match[1]} ${match[2]}`
      )
    );
  }

  return [...completed].sort();
}

function extractInProgressCourses(
  text: string
): InProgressCourse[] {
  const flat = text
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ");

  const courses =
    new Map<string, InProgressCourse>();

  const pattern =
    /\b([A-Z]{2,6})\s+(\d{3}[A-Z]{0,2})\s+(.{1,100}?)\s+IP\s+\((\d+(?:\.\d+)?)\)\s+(FALL|SPRING|SUMMER|WINTER(?:\s+MINI-MESTER)?)\s+(\d{4})/g;

  for (const match of flat.matchAll(pattern)) {
    const courseCode =
      normalizeCourseCode(
        `${match[1]} ${match[2]}`
      );

    if (courses.has(courseCode)) {
      continue;
    }

    courses.set(courseCode, {
      courseCode,

      title: match[3]
        .replace(/\s+/g, " ")
        .trim(),

      credits: Number(match[4]),

      term: `${match[5]} ${match[6]}`,
    });
  }

  return [...courses.values()];
}

function extractRemainingCredits(section: string) {
  const match = section.match(
    /you still need\s+(\d+(?:\.\d+)?)\s+more credits/i
  );

  if (!match) {
    return null;
  }

  return Number(match[1]);
}

export async function POST(request: Request) {
  let parser: PDFParse | null = null;

  try {
    const formData =
      await request.formData();

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error:
            "Please upload a DegreeWorks PDF.",
        },
        {
          status: 400,
        }
      );
    }

    const arrayBuffer =
      await file.arrayBuffer();

    const buffer =
      Buffer.from(arrayBuffer);

    parser = new PDFParse({
      data: buffer,
    });

    const parsed =
      await parser.getText();

    const rawText = parsed.text
      .replace(/\r/g, "")
      .replace(/\u00ad/g, "")
      .replace(/\uFFFE/g, "")
      .replace(/[ \t]+/g, " ")
      .trim();

    const flatText = rawText
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ");

    const universitySection =
      getSection(
        rawText,
        /University Requirements INCOMPLETE/i,
        /General Education Program INCOMPLETE/i
      );

    const generalEducationSection =
      getSection(
        rawText,
        /General Education Program INCOMPLETE/i,
        /Major .+? INCOMPLETE/i
      );

    const majorSection =
      getSection(
        rawText,
        /Major .+? INCOMPLETE/i,
        /Business and Management Support and Core INCOMPLETE/i
      );

    const businessSection =
      getSection(
        rawText,
        /Business and Management Support and Core INCOMPLETE/i,
        /Free Electives/i
      );

    const universityRequirements =
      extractRequirements(
        universitySection,
        "University Requirements"
      );

    const generalEducationRequirements =
      extractRequirements(
        generalEducationSection,
        "General Education"
      );

    const majorRequirements =
      extractRequirements(
        majorSection,
        "Major"
      );

    const businessRequirements =
      extractRequirements(
        businessSection,
        "Business/Core"
      );

    const requirements = [
      ...universityRequirements,
      ...generalEducationRequirements,
      ...majorRequirements,
      ...businessRequirements,
    ];

    const degree =
      flatText.match(
        /Degree\s+(.+?)\s+Audit date/i
      )?.[1]?.trim() ?? "";

    const major =
      flatText.match(
        /Major\s+(.+?)\s+Program\s+/i
      )?.[1]?.trim() ?? "";

    const catalogYear =
      flatText.match(
        /Catalog year:\s*([A-Z]+\s+\d{4})/i
      )?.[1]?.trim() ?? "";

    const degreeProgress =
      Number(
        flatText.match(
          /Degree progress\s+(\d+)%/i
        )?.[1] ?? 0
      );

    const requirementsProgress =
      Number(
        flatText.match(
          /Requirements\s+(\d+)%/i
        )?.[1] ?? 0
      );

    const gpa =
      flatText.match(
        /Overall GPA\s+([\d.]+)/i
      )?.[1] ?? "0.000";

    const creditsMatch =
      flatText.match(
        /Credits required:\s*(\d+)\s+Credits applied:\s*(\d+)/i
      );

    const creditsRequired =
      Number(
        creditsMatch?.[1] ?? 0
      );

    const creditsApplied =
      Number(
        creditsMatch?.[2] ?? 0
      );

    const minimumCreditsTo120 =
      Math.max(
        0,
        creditsRequired -
          creditsApplied
      );

    const knownRemainingCredits = [
      extractRemainingCredits(
        generalEducationSection
      ),
      extractRemainingCredits(
        majorSection
      ),
      extractRemainingCredits(
        businessSection
      ),
    ]
      .filter(
        (
          value
        ): value is number =>
          value !== null
      )
      .reduce(
        (total, value) =>
          total + value,
        0
      );

    const outstandingCourseCount =
      requirements.reduce(
        (total, requirement) =>
          total +
          requirement.choose,
        0
      );

    return NextResponse.json({
      success: true,

      student: {
        degree,
        major,
        catalogYear,
      },

      academicSummary: {
        degreeProgress,
        requirementsProgress,
        gpa,

        creditsRequired,
        creditsApplied,

        minimumCreditsTo120,

        outstandingCourseCount,

        /*
          This comes from the explicit
          remaining-credit totals in
          Gen Ed + Major + Business/Core.

          The separate University
          requirement has variable credit
          options, so the UI will display
          this as "51+" rather than
          pretending it is exact.
        */
        knownRemainingRequirementCredits:
          knownRemainingCredits,

        hasVariableCreditRequirement:
          universityRequirements.length >
          0,
      },

      completedCourses:
        extractCompletedCourses(
          rawText
        ),

      inProgress:
        extractInProgressCourses(
          rawText
        ),

      requirements,

      rawText,
    });
  } catch (error) {
    console.error(
      "DegreeWorks parsing error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          "StudentDash could not analyze this DegreeWorks PDF.",
      },
      {
        status: 500,
      }
    );
  } finally {
    if (parser) {
      await parser.destroy();
    }
  }
}