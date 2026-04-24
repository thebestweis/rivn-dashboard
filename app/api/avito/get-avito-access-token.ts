type AvitoTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

let cachedToken: {
  accessToken: string;
  expiresAt: number;
} | null = null;

export async function getAvitoAccessToken() {
  const now = Date.now();

  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.accessToken;
  }

  const clientId = process.env.AVITO_CLIENT_ID;
  const clientSecret = process.env.AVITO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Не найдены AVITO_CLIENT_ID или AVITO_CLIENT_SECRET");
  }

  const response = await fetch("https://api.avito.ru/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
  });

  const data = (await response.json()) as AvitoTokenResponse;

  if (!response.ok || !data.access_token) {
    throw new Error(`Ошибка получения Avito токена: ${JSON.stringify(data)}`);
  }

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return data.access_token;
}