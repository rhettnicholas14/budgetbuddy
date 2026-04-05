import { NextResponse } from "next/server";
import { createBasiqConnectLink } from "@/lib/basiq/service";

export async function POST() {
  try {
    const result = await createBasiqConnectLink();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to create Basiq link." },
      { status: 500 },
    );
  }
}
