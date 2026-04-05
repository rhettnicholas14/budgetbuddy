import { NextResponse } from "next/server";
import { syncBasiqTransactions } from "@/lib/basiq/service";

export async function POST() {
  try {
    const result = await syncBasiqTransactions();
    return NextResponse.json({
      message: `Synced ${result?.length ?? 0} transactions.`,
      count: result?.length ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Basiq sync failed." },
      { status: 500 },
    );
  }
}
