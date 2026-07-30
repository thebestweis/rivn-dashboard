import { GET as runAvitoTestReport } from "@/app/api/avito/test-report/route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  return runAvitoTestReport(request);
}
