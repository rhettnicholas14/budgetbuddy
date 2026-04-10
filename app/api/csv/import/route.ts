import { NextResponse } from "next/server";
import { importCsvText } from "@/lib/csv/importer";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "No CSV file provided." }, { status: 400 });
    }

    const text = await file.text();
    const result = await importCsvText(file.name, text);

    return NextResponse.json({
      message: result.message,
      count: result.insertedCount,
      alreadyLoadedCount: result.alreadyLoadedCount,
      skippedOlderThanWatermarkCount: result.skippedOlderThanWatermarkCount,
      totalRows: result.totalRows,
    });
  } catch (error) {
    console.error("CSV import failed", error);
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "CSV import failed.",
        ...(process.env.NODE_ENV !== "production" && error instanceof Error ? { stack: error.stack } : {}),
      },
      { status: 500 },
    );
  }
}
