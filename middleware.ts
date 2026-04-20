import { NextRequest, NextResponse } from "next/server";

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Standard response for non-API routes or successful API auth
  const response = NextResponse.next();

  // Add Global CORS Headers for all API routes
  if (pathname.startsWith("/api/")) {
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-workspace-id");
    response.headers.set("Access-Control-Allow-Credentials", "true");

    // Handle OPTIONS preflight
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: response.headers,
      });
    }
  }

  const publicRoutes = ["/", "/sign-in", "/sign-up", "/verify-email", "/forgot-password", "/reset-password"];
  if (publicRoutes.includes(pathname)) {
    return response;
  }

  if (pathname.startsWith("/w/")) {
    const sessionToken =
      request.cookies.get("better-auth.session_token")?.value ||
      request.cookies.get("__Secure-better-auth.session_token")?.value ||
      request.cookies.get("__session")?.value;

    if (!sessionToken) {
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signInUrl);
    }
    return response;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|api/webhooks|$).*)"
  ]
};
