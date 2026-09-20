import { NextResponse } from "next/server";
import { getData } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

PDFParse.setWorker(getData());

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

function getFirstMatch(text: string, pattern: RegExp): string {
  const match = text.match(pattern);
  return match?.[1]?.trim() ?? "";
}

function getSection(
  text: string,
  startMarker: string,
  endMarker: string
): string {
  const start = text.indexOf(startMarker);

  if (start === -1) {
    return "";
  }

  const end = text.indexOf(endMarker, start + startMarker.length);

  if (end === -1) {
    return text.slice(start);
  }

  return text.slice(start, end);
}

function extractInProgressCourses(text: string): Course[] {
  const section = getSection(
    text,
    "In-progress Credits:",
    "Legend"
  );

  if (!section) {
    return [];
  }

  const cleanedSection = section.replace(/\s+/g, " ");

  const coursePattern =
    /([A-Z]{2,5}\s+\d{3}[A-Z]?)\s+(.+?)\s+IP\s+\((\d+(?:\.\d+)?)\)\s+(FALL|SPRING|SUMMER|WINTER(?:\s+MINI-MESTER)?)\s+(\d{4})/g;

  const matches = [...cleanedSection.matchAll(coursePattern)];

  return matches.map((match) => ({
    code: match[1].trim(),
    title: match[2].trim(),
    credits: Number(match[3]),
    term: `${match[4]} ${match[5]}`,
  }));
}

function extractRequiredCourses(section: string): RequiredCourse[] {
  if (!section) {
    return [];
  }

  const coursePattern =
    /Still needed:\s*1 Class in\s+([A-Z]{2,5})\s+(\d{3}[A-Z]?)(?:\s+or\s+(\d{3}[A-Z]?))?/g;

  const matches = [...section.matchAll(coursePattern)];

  const results: RequiredCourse[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const subject = match[1];
    const firstNumber = match[2];
    const secondNumber = match[3];

    const options = [`${subject} ${firstNumber}`];

    if (secondNumber) {
      options.push(`${subject} ${secondNumber}`);
    }

    const display = options.join(" / ");

    if (!seen.has(display)) {
      seen.add(display);

      results.push({
        display,
        options,
      });
    }
  }

  return results;
}

export async function POST(request: Request) {
  let parser: PDFParse | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error: "No PDF file was uploaded.",
        },
        {
          status: 400,
        }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        {
          error: "The uploaded file must be a PDF.",
        },
        {
          status: 400,
        }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    parser = new PDFParse({
      data: buffer,
    });

    const parsedPDF = await parser.getText();
    const text = parsedPDF.text;

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        {
          error:
            "No readable text was found in this PDF.",
        },
        {
          status: 400,
        }
      );
    }

    const degree = getFirstMatch(
      text,
      /Degree\s+([^\n]+)/
    );

    const major = getFirstMatch(
      text,
      /\bMajor\s+(.+?)\s+Program\b/
    );

    const progress = getFirstMatch(
      text,
      /Degree progress\s+(\d+)%/
    );

    const requirementsProgress = getFirstMatch(
      text,
      /Requirements\s+(\d+)%/
    );

    const gpa = getFirstMatch(
      text,
      /Overall GPA\s+([\d.]+)/
    );

    const catalogYear = getFirstMatch(
      text,
      /Catalog year:\s*([A-Z]+\s+\d{4})/
    );

    const creditsSummary = text.match(
      /Credits required:\s*(\d+)\s+Credits applied:\s*(\d+)/
    );

    const creditsRequired = creditsSummary
      ? Number(creditsSummary[1])
      : 0;

    const creditsApplied = creditsSummary
      ? Number(creditsSummary[2])
      : 0;

    const creditsRemainingMatch = text.match(
      /You still need\s+(\d+)\s+more\s+credits/
    );

    const creditsRemaining = creditsRemainingMatch
      ? Number(creditsRemainingMatch[1])
      : Math.max(creditsRequired - creditsApplied, 0);

    const generalEducationSection = getSection(
      text,
      "General Education Program INCOMPLETE",
      "Major Cybersecurity Intelligence Management"
    );

    const generalEducationRemainingMatch =
      generalEducationSection.match(
        /you still need\s+(\d+)\s+more credits/i
      );

    const generalEducationCreditsRemaining =
      generalEducationRemainingMatch
        ? Number(generalEducationRemainingMatch[1])
        : 0;

    const majorSection = getSection(
      text,
      "Major Cybersecurity Intelligence Management INCOMPLETE",
      "Business and Management Support and Core"
    );

    const businessSection = getSection(
      text,
      "Business and Management Support and Core INCOMPLETE",
      "Free Electives"
    );

    const remainingMajorCourses =
      extractRequiredCourses(majorSection);

    const remainingBusinessCourses =
      extractRequiredCourses(businessSection);

    const inProgressCourses =
      extractInProgressCourses(text);

    const inProgressCredits =
      inProgressCourses.reduce(
        (total, course) => total + course.credits,
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
        degreeProgress: Number(progress || 0),
        requirementsProgress: Number(
          requirementsProgress || 0
        ),
        gpa,
        creditsRequired,
        creditsApplied,
        creditsRemaining,
        generalEducationCreditsRemaining,
      },

      inProgress: {
        credits: inProgressCredits,
        courses: inProgressCourses,
      },

      remainingRequirements: {
        majorCourses: remainingMajorCourses,
        businessCourses: remainingBusinessCourses,
      },

      rawText: text,
    });
  } catch (error) {
    console.error("Degree audit parsing error:", error);

    return NextResponse.json(
      {
        error: "StudentDash could not analyze this DegreeWorks PDF.",
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