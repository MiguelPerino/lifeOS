import { NextResponse } from "next/server";
import { getWorkspace } from "@/services/workspace";
import { apiError } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(await getWorkspace(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
