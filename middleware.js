import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static")
  ) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  console.log(`🔒 Middleware Debug: Path=${pathname}`);
  console.log(`   - Cookies: ${req.cookies.getAll().map(c => c.name).join(', ')}`);
  console.log(`   - Token found: ${!!token}`);
  if (!token) {
    console.log("   - Redirecting to /login due to missing token");
  }

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/laporan-sesi",
    "/laporan-bangkit",
    "/laporan-maju-um",
    "/upward-mobility",
    "/growthwheel",
  ],
};
