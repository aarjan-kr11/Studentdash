import * as cheerio from "cheerio";

export type MorganCourse = {
  university: string;
  courseCode: string;
  sourceCourseCode: string;

  title: string;
  credits: number | null;

  prerequisiteText: string;

  /*
    OR-of-AND structure.

    Example:
    [["MATH 113"]]

    means:
    MATH 113 is required.

    Example:
    [["COURSE 201"], ["COURSE 211"]]

    means:
    COURSE 201 OR COURSE 211.
  */
  prerequisitePaths: string[][];

  minimumGrade: string | null;

  offering: string | null;

  specialRequirements: string[];

  sourceUrl: string;

  catalogTerm: string | null;

  fetchedAt: string;
};

type CacheEntry = {
  expiresAt: number;
  data: MorganCourse;
};

type TermCache = {
  expiresAt: number;
  terms: string[];
};

const ONE_DAY =
  1000 * 60 * 60 * 24;

const BANNER_BASE =
  "https://lbssbnprod.morgan.edu/nprod";

const CATALOG_TERM_URL =
  `${BANNER_BASE}/bwckctlg.p_disp_dyn_ctlg`;

const courseCache =
  new Map<string, CacheEntry>();

let termCache:
  | TermCache
  | null = null;


/*
  Morgan has changed some course
  prefixes over time.

  When DegreeWorks uses a newer code
  but an older Banner catalog uses the
  previous code, StudentDash can try
  both.

  We can extend this list whenever
  Morgan changes another prefix.
*/
const COURSE_ALIASES:
  Record<string, string[]> = {

  "MGBU 202": [
    "BUAD 202",
  ],

  "MGBU 324": [
    "MGMT 324",
  ],

  "MGBU 326": [
    "BUAD 326",
  ],

  "MGBU 327": [
    "BUAD 327",
  ],

  "MGBU 381": [
    "BUAD 381",
  ],

  "MGBU 499": [
    "BUAD 499",
  ],

  "SSCM 220": [
    "INSS 220",
  ],

  "SSCM 328": [
    "MGMT 328",
  ],
};


function normalizeCourseCode(
  input: string
) {
  const cleaned = input
    .trim()
    .toUpperCase()
    .replace(/\./g, "")
    .replace(/\s+/g, "");

  const match =
    cleaned.match(
      /^([A-Z]{2,6})(\d{3}[A-Z]?)$/
    );

  if (!match) {
    throw new Error(
      `Invalid Morgan course code: ${input}`
    );
  }

  return `${match[1]} ${match[2]}`;
}


function splitCourseCode(
  courseCode: string
) {
  const normalized =
    normalizeCourseCode(
      courseCode
    );

  const [subject, number] =
    normalized.split(" ");

  return {
    normalized,
    subject,
    number,
  };
}


function getCandidateCodes(
  requested: string
) {
  const normalized =
    normalizeCourseCode(
      requested
    );

  return [
    normalized,
    ...(COURSE_ALIASES[
      normalized
    ] ?? []),
  ];
}


async function fetchHtml(
  url: string
) {
  const response =
    await fetch(url, {
      headers: {
        Accept:
          "text/html,application/xhtml+xml",

        "User-Agent":
          "StudentDash academic planning prototype",
      },

      cache: "no-store",
    });

  if (!response.ok) {
    throw new Error(
      `Morgan Banner returned HTTP ${response.status}.`
    );
  }

  return response.text();
}


/*
  Banner exposes its available
  catalog terms in a <select> element.

  We discover them automatically
  instead of hard-coding Fall 2021,
  Spring 2022, etc.
*/
async function getCatalogTerms() {
  if (
    termCache &&
    termCache.expiresAt >
      Date.now()
  ) {
    return termCache.terms;
  }

  const html =
    await fetchHtml(
      CATALOG_TERM_URL
    );

  const $ =
    cheerio.load(html);

  const terms: string[] = [];

  $("select option").each(
    (_, element) => {
      const value =
        $(element)
          .attr("value")
          ?.trim();

      if (
        value &&
        /^\d{6}$/.test(value)
      ) {
        terms.push(value);
      }
    }
  );

  /*
    Newest Banner term codes should
    normally be numerically largest.
  */
  const uniqueTerms =
    [...new Set(terms)]
      .sort(
        (a, b) =>
          Number(b) -
          Number(a)
      );

  /*
    Emergency fallback if Banner ever
    changes the term-selection HTML.

    These are only used to avoid a
    total failure; normally the live
    term list above is used.
  */
  if (
    uniqueTerms.length === 0
  ) {
    uniqueTerms.push(
      "202670",
      "202660",
      "202630",
      "202570",
      "202530",
      "202470",
      "202430",
      "202370",
      "202330",
      "202270",
      "202230",
      "202170",
      "201930"
    );
  }

  termCache = {
    terms:
      uniqueTerms,

    expiresAt:
      Date.now() +
      ONE_DAY,
  };

  return uniqueTerms;
}


function buildDetailUrl(
  term: string,
  subject: string,
  number: string
) {
  const params =
    new URLSearchParams({
      cat_term_in: term,
      subj_code_in:
        subject,
      crse_numb_in:
        number,
    });

  return (
    `${BANNER_BASE}` +
    `/bwckctlg.p_disp_course_detail?` +
    params.toString()
  );
}


function pageTextFromHtml(
  html: string
) {
  const $ =
    cheerio.load(html);

  $(
    "script, style, noscript"
  ).remove();

  return $("body")
    .text()
    .replace(/\u00a0/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}


function pageHasCourse(
  pageText: string,
  courseCode: string
) {
  const escaped =
    courseCode.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

  return new RegExp(
    `\\b${escaped}\\s*-`,
    "i"
  ).test(pageText);
}


/*
  Try newest catalog terms first.

  This allows newer CYBR/NURS/etc.
  courses to be found without us
  manually maintaining department
  pages.
*/
async function findCoursePage(
  requestedCourseCode: string
) {
  const candidates =
    getCandidateCodes(
      requestedCourseCode
    );

  const terms =
    await getCatalogTerms();

  /*
    Looking through a reasonable number
    of recent catalog terms prevents a
    massive request loop while still
    handling courses introduced several
    years ago.

    If needed, this number can be raised.
  */
  const termsToTry =
    terms.slice(0, 30);

  for (
    const candidate of
    candidates
  ) {
    const {
      subject,
      number,
    } =
      splitCourseCode(
        candidate
      );

    for (
      const term of
      termsToTry
    ) {
      const url =
        buildDetailUrl(
          term,
          subject,
          number
        );

      try {
        const html =
          await fetchHtml(url);

        const pageText =
          pageTextFromHtml(
            html
          );

        if (
          pageHasCourse(
            pageText,
            candidate
          )
        ) {
          return {
            sourceCourseCode:
              candidate,

            term,

            url,

            pageText,
          };
        }
      } catch {
        /*
          If one historical term fails,
          try the next one instead of
          killing the entire lookup.
        */
      }
    }
  }

  throw new Error(
    `${requestedCourseCode} was not found in Morgan's public Banner catalog.`
  );
}


function extractTitle(
  text: string,
  sourceCode: string
) {
  const escaped =
    sourceCode.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

  const match =
    text.match(
      new RegExp(
        `${escaped}\\s*-\\s*(.+?)(?=\\s+(?:\\d+(?:\\.\\d+)?\\s+credits?|This course|A course|The course|Designed|An introduction|An advanced|Students|Course))`,
        "i"
      )
    );

  if (match) {
    return match[1]
      .replace(/\s+/g, " ")
      .trim();
  }

  /*
    Fallback: grab text directly
    following "CODE -".
  */
  const fallback =
    text.match(
      new RegExp(
        `${escaped}\\s*-\\s*([^0-9]{2,120})`,
        "i"
      )
    );

  return fallback
    ? fallback[1]
        .replace(/\s+/g, " ")
        .trim()
    : sourceCode;
}


function extractCredits(
  text: string
) {
  /*
    Prefer Banner's standardized:
    "3.000 Credit hours"
  */
  const standard =
    text.match(
      /(\d+(?:\.\d+)?)\s+Credit hours/i
    );

  if (standard) {
    return Number(
      standard[1]
    );
  }

  /*
    Fallback for description text:
    "3 credits"
  */
  const description =
    text.match(
      /(\d+(?:\.\d+)?)\s+credits?\b/i
    );

  if (description) {
    return Number(
      description[1]
    );
  }

  return null;
}


function extractOffering(
  text: string
) {
  const offered =
    text.match(
      /Offered\s*\(?\s*(FALL|SPRING|SUMMER|WINTER|OFFERED AS NEEDED|TBD)(?:\s*(?:\/|,|OR|AND)\s*(FALL|SPRING|SUMMER|WINTER))?(?:\s*(?:\/|,|OR|AND)\s*(FALL|SPRING|SUMMER|WINTER))?\s*\)?/i
    );

  if (!offered) {
    return null;
  }

  return offered[0]
    .replace(
      /^Offered\s*/i,
      ""
    )
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}


function extractPrerequisiteSection(
  text: string
) {
  const index =
    text.indexOf(
      "Prerequisites:"
    );

  if (index === -1) {
    return "";
  }

  let section =
    text.slice(
      index +
        "Prerequisites:"
          .length
    );

  const endings = [
    "Return to Previous",
    "New Search",
    "Release:",
  ];

  let end =
    section.length;

  for (
    const ending of endings
  ) {
    const position =
      section.indexOf(
        ending
      );

    if (
      position !== -1 &&
      position < end
    ) {
      end = position;
    }
  }

  return section
    .slice(0, end)
    .replace(/\s+/g, " ")
    .trim();
}


type RequirementToken = {
  courseCode: string;
  grade: string | null;
  start: number;
  end: number;
};


function parseRequirementTokens(
  prerequisiteText: string
) {
  const tokens:
    RequirementToken[] = [];

  const pattern =
    /(?:Undergraduate|Graduate)\s+level\s+([A-Z]{2,6})\s+(\d{3}[A-Z]?)(?:\s+Minimum Grade of\s+([A-Z][+-]?|TR|R|P|S))?/gi;

  for (
    const match of
    prerequisiteText.matchAll(
      pattern
    )
  ) {
    if (
      match.index ===
      undefined
    ) {
      continue;
    }

    tokens.push({
      courseCode:
        `${match[1].toUpperCase()} ${match[2].toUpperCase()}`,

      grade:
        match[3]
          ? match[3]
              .toUpperCase()
          : null,

      start:
        match.index,

      end:
        match.index +
        match[0].length,
    });
  }

  return tokens;
}


function academicGrade(
  grade: string | null
) {
  if (!grade) {
    return null;
  }

  /*
    Banner often lists the same course
    multiple times because grades such
    as C, R, and TR are alternative
    ways to satisfy the SAME
    prerequisite.

    R/TR are not treated as the
    academic minimum grade.
  */
  if (
    grade === "R" ||
    grade === "TR"
  ) {
    return null;
  }

  return grade;
}


function getMinimumGrade(
  tokens: RequirementToken[]
) {
  for (
    const token of tokens
  ) {
    const grade =
      academicGrade(
        token.grade
      );

    if (grade) {
      return grade;
    }
  }

  return null;
}


/*
  Convert Banner text into a simple
  OR-of-AND dependency structure.

  This handles the common Banner cases
  while preserving the original raw
  prerequisite text for anything more
  complicated.
*/
function buildPrerequisitePaths(
  prerequisiteText: string,
  tokens: RequirementToken[]
) {
  if (
    tokens.length === 0
  ) {
    return [];
  }

  /*
    Deduplicate repeated Banner entries
    for the same course, which often
    differ only by acceptable grade
    type such as C / R / TR.
  */
  const unique:
    RequirementToken[] = [];

  for (
    const token of tokens
  ) {
    const existing =
      unique.find(
        (item) =>
          item.courseCode ===
          token.courseCode
      );

    if (!existing) {
      unique.push(token);
    }
  }

  if (
    unique.length === 1
  ) {
    return [
      [
        unique[0]
          .courseCode,
      ],
    ];
  }

  /*
    Examine text between distinct
    requirement tokens.

    "A and B"
      -> [["A", "B"]]

    "A or B"
      -> [["A"], ["B"]]
  */
  const paths:
    string[][] = [
      [
        unique[0]
          .courseCode,
      ],
    ];

  for (
    let i = 1;
    i < unique.length;
    i++
  ) {
    const previous =
      unique[i - 1];

    const current =
      unique[i];

    const between =
      prerequisiteText
        .slice(
          previous.end,
          current.start
        )
        .toLowerCase();

    if (
      /\bor\b/.test(
        between
      )
    ) {
      paths.push([
        current.courseCode,
      ]);
    } else {
      /*
        Banner sometimes does not print
        an explicit "and". In that case,
        multiple distinct courses are
        conservatively treated as AND.
      */
      paths[
        paths.length - 1
      ].push(
        current.courseCode
      );
    }
  }

  return paths;
}


function extractSpecialRequirements(
  pageText: string,
  prerequisiteSection: string
) {
  const requirements:
    string[] = [];

  /*
    Description-based requirements may
    not appear as course-code
    prerequisites.
  */
  const descriptionPatterns = [
    /Departmental Chair permission required[^.]*\.?/i,
    /departmental permission[^.]*\.?/i,
    /permission of (?:the )?instructor[^.]*\.?/i,
    /permission of (?:the )?department[^.]*\.?/i,
    /senior standing[^.]*\.?/i,
    /junior standing[^.]*\.?/i,
    /sophomore standing[^.]*\.?/i,
  ];

  for (
    const pattern of
    descriptionPatterns
  ) {
    const match =
      pageText.match(
        pattern
      );

    if (
      match &&
      !requirements.includes(
        match[0]
      )
    ) {
      requirements.push(
        match[0]
          .replace(
            /\s+/g,
            " "
          )
          .trim()
      );
    }
  }

  /*
    If Banner has prerequisite text but
    no normal course-code tokens, keep
    that rule visible instead of
    pretending there is no prerequisite.
  */
  if (
    prerequisiteSection &&
    parseRequirementTokens(
      prerequisiteSection
    ).length === 0
  ) {
    const cleaned =
      prerequisiteSection
        .replace(/\s+/g, " ")
        .trim();

    if (
      cleaned.length > 0 &&
      !requirements.includes(
        cleaned
      )
    ) {
      requirements.push(
        cleaned
      );
    }
  }

  return requirements;
}


export async function getMorganCourse(
  inputCourseCode: string
) {
  const requestedCode =
    normalizeCourseCode(
      inputCourseCode
    );

  const cached =
    courseCache.get(
      requestedCode
    );

  if (
    cached &&
    cached.expiresAt >
      Date.now()
  ) {
    return {
      course:
        cached.data,

      cacheStatus:
        "hit" as const,
    };
  }

  const page =
    await findCoursePage(
      requestedCode
    );

  const prerequisiteText =
    extractPrerequisiteSection(
      page.pageText
    );

  const requirementTokens =
    parseRequirementTokens(
      prerequisiteText
    );

  const course:
    MorganCourse = {

    university:
      "Morgan State University",

    courseCode:
      requestedCode,

    sourceCourseCode:
      page.sourceCourseCode,

    title:
      extractTitle(
        page.pageText,
        page.sourceCourseCode
      ),

    credits:
      extractCredits(
        page.pageText
      ),

    prerequisiteText:
      prerequisiteText ||
      "No course prerequisite listed in Banner.",

    prerequisitePaths:
      buildPrerequisitePaths(
        prerequisiteText,
        requirementTokens
      ),

    minimumGrade:
      getMinimumGrade(
        requirementTokens
      ),

    offering:
      extractOffering(
        page.pageText
      ),

    specialRequirements:
      extractSpecialRequirements(
        page.pageText,
        prerequisiteText
      ),

    sourceUrl:
      page.url,

    catalogTerm:
      page.term,

    fetchedAt:
      new Date()
        .toISOString(),
  };

  courseCache.set(
    requestedCode,
    {
      data: course,

      expiresAt:
        Date.now() +
        ONE_DAY,
    }
  );

  return {
    course,

    cacheStatus:
      "miss" as const,
  };
}