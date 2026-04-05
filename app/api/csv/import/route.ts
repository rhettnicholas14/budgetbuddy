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
    const imported = await importCsvText(file.name, text);

    return NextResponse.json({
      message: `Imported ${imported.length} transaction${imported.length === 1 ? "" : "s"}.`,
      count: imported.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "CSV import failed.",
      },
      { status: 500 },
    );
  }
}
