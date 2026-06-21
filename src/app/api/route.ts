import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  return NextResponse.json({
    message: "Score Distributor API",
    status: "ok",
    time: new Date().toISOString(),
  });
}
