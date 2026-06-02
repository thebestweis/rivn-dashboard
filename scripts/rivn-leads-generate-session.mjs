import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Api, TelegramClient } from "telegram";
import { computeCheck } from "telegram/Password.js";
import { StringSession } from "telegram/sessions/index.js";

function loadEnvFile(fileName) {
  const path = resolve(process.cwd(), fileName);
  if (!existsSync(path)) return;

  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env.production");
loadEnvFile(".env.local");

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

if (!Number.isInteger(apiId) || apiId <= 0) {
  throw new Error("TELEGRAM_API_ID не заполнен или заполнен некорректно");
}

if (!apiHash) {
  throw new Error("TELEGRAM_API_HASH не заполнен");
}

const rl = createInterface({ input, output });
const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
  connectionRetries: 5,
  useWSS: false,
});

function clean(value) {
  return value.trim();
}

async function ask(question) {
  return clean(await rl.question(question));
}

function describeError(error) {
  if (error && typeof error === "object") {
    const maybe = error;
    return [maybe.errorMessage, maybe.message, maybe.code ? `code=${maybe.code}` : null].filter(Boolean).join(" | ");
  }
  return String(error);
}

async function checkPassword() {
  const passwordInfo = await client.invoke(new Api.account.GetPassword());
  const password = await ask("2FA пароль Telegram: ");
  const passwordCheck = await computeCheck(passwordInfo, password);
  await client.invoke(new Api.auth.CheckPassword({ password: passwordCheck }));
}

async function signIn(phoneNumber, phoneCodeHash) {
  const phoneCode = await ask("Код из Telegram: ");
  try {
    await client.invoke(new Api.auth.SignIn({ phoneNumber, phoneCodeHash, phoneCode }));
  } catch (error) {
    const message = describeError(error);
    if (message.includes("SESSION_PASSWORD_NEEDED")) {
      await checkPassword();
      return;
    }
    throw error;
  }
}

async function main() {
  console.log("RIVN Leads: генератор Telegram session string");
  console.log("Используй только reader-аккаунты, у которых есть законный доступ к нужным Telegram-чатам.");
  console.log("");

  await client.connect();
  const phoneNumber = await ask("Телефон reader-аккаунта с кодом страны: ");
  const preferSms = (await ask("Сразу запросить SMS? y/N: ")).toLowerCase() === "y";

  console.log("Запрашиваю код Telegram...");
  let sentCode = await client.sendCode({ apiId, apiHash }, phoneNumber, preferSms);
  console.log(`Код отправлен: ${sentCode.isCodeViaApp ? "в приложение Telegram / 777000" : "через SMS или звонок"}`);

  const resend = (await ask("Если код не пришёл, напиши sms. Если пришёл, нажми Enter: ")).toLowerCase();
  if (resend === "sms") {
    console.log("Запрашиваю SMS-код...");
    sentCode = await client.sendCode({ apiId, apiHash }, phoneNumber, true);
    console.log(`Код отправлен повторно: ${sentCode.isCodeViaApp ? "в приложение Telegram / 777000" : "через SMS или звонок"}`);
  }

  await signIn(phoneNumber, sentCode.phoneCodeHash);

  const sessionString = client.session.save();
  console.log("");
  console.log("Session string:");
  console.log(sessionString);
  console.log("");
  console.log("Скопируй это значение в /admin-leads -> Reader-аккаунты -> Telegram session string.");

  await client.disconnect();
}

main()
  .catch((error) => {
    console.error("Не удалось создать session string:", describeError(error));
    process.exitCode = 1;
  })
  .finally(() => {
    rl.close();
  });
