import { NextResponse } from "next/server";
import { getMorganCourse } from "@/lib/morganCourse";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const courseCode = searchParams.get("course");

    if (!courseCode) {
      return NextResponse.json(
        {
          error: "A course code is required.",
        },
        {
          status: 400,
        }
      );
    }

    const result = await getMorganCourse(courseCode);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Morgan course lookup error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to retrieve course information.";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}