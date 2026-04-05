import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const outcome = url.searchParams.get("status") ?? "connected";
  return NextResponse.redirect(new URL(`/settings?basiq=${outcome}`, request.url));
}
