// middleware.js
export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/", "/laporan-sesi", "/laporan-bangkit", "/laporan-maju-um", "/upward-mobility", "/growthwheel"],
};
