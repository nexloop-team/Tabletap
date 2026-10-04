import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate for merchant pages: no session cookie means straight to the
 * login page (remembering where they were going). The real check, including
 * expiry and venue ownership, happens on the server for every page and API.
 */
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname + request.nextUrl.search;
  if (request.cookies.has("tt_session")) {
    // An expired session is only discovered by the page itself, which can't
    // see its own URL; pass it along so the login can send them back here.
    const headers = new Headers(request.headers);
    headers.set("x-pathname", path);
    return NextResponse.next({ request: { headers } });
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("next", path);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding", "/admin/:path*"],
};
