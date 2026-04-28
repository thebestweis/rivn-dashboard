import { GET as runDailyCron } from "../daily/route";

export async function GET(request: Request) {
  return runDailyCron(request);
}
