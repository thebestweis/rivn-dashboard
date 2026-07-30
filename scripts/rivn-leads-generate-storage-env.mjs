import { createHmac, randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function signServiceToken(secret) {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      role: "service_role",
      iss: "rivn-leads-storage",
      iat: Math.floor(Date.now() / 1000),
    })
  );
  const signature = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}

function outputPath() {
  const outputIndex = process.argv.indexOf("--output");
  const value = outputIndex >= 0 ? process.argv[outputIndex + 1] : "";
  if (!value) {
    throw new Error(
      "Use --output /absolute/path/to/deploy/rivn-leads-storage/.env"
    );
  }
  return resolve(value);
}

const destination = outputPath();
if (existsSync(destination) && !process.argv.includes("--force")) {
  throw new Error(
    `${destination} already exists. Refusing to overwrite it without --force.`
  );
}

const postgresPassword = randomBytes(32).toString("hex");
const postgrestPassword = randomBytes(32).toString("hex");
const jwtSecret = randomBytes(48).toString("hex");
const serviceKey = signServiceToken(jwtSecret);

const content = [
  "POSTGRES_DB=rivn_leads",
  "POSTGRES_USER=postgres",
  `POSTGRES_PASSWORD=${postgresPassword}`,
  `POSTGREST_DB_PASSWORD=${postgrestPassword}`,
  `PGRST_JWT_SECRET=${jwtSecret}`,
  `RIVN_LEADS_DATABASE_SERVICE_KEY=${serviceKey}`,
  "",
].join("\n");

writeFileSync(destination, content, { encoding: "utf8", mode: 0o600 });
console.log(`RIVN Leads storage secrets written to ${destination}`);
