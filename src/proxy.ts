import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate for merchant pages: no session cookie means straight to the
 * login page (remembering where they were going). The real check, including
 * expiry and venue ownership, happens on the server for every page and API.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has("tt_session")) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding", "/admin/:path*"],
};
