import type { NextRequest } from "next/server";
import { updateSession } from "./app/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/clients/:path*",
    "/projects/:path*",
    "/tasks/:path*",
    "/payments/:path*",
    "/expenses/:path*",
    "/payroll/:path*",
    "/analytics/:path*",
    "/avito-reports/:path*",
    "/crm/:path*",
    "/billing/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/login",
    "/register",
    "/session-expired",
  ],
};
