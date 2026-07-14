import { NextResponse, type NextRequest } from "next/server";

// Open-access mode: no login required, so the proxy no longer guards routes.
// Kept as a pass-through; re-add session handling here to restore auth.
export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
