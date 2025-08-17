// middleware.js
export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/", "/laporan-sesi", "/upward-mobility", "/growthwheel"],
};
