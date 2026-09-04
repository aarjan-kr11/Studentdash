import { NextResponse } from "next/server";
import { getData } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

PDFParse.setWorker(getData());

export async function POST(request: Request) {
  let parser: PDFParse | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No PDF file uploaded." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    parser = new PDFParse({
      data: buffer,
    });

    const result = await parser.getText();

    return NextResponse.json({
      text: result.text,
    });
  } catch (error) {
    console.error("PDF parsing error:", error);

    return NextResponse.json(
      { error: "Failed to analyze PDF." },
      { status: 500 }
    );
  } finally {
    if (parser) {
      await parser.destroy();
    }
  }
}