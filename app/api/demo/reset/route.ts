import { NextResponse } from "next/server";
import { resetDemoSnapshot } from "@/lib/mock/store";

export async function POST() {
  const snapshot = resetDemoSnapshot();
  return NextResponse.json({ ok: true, transactions: snapshot.transactions.length });
}
