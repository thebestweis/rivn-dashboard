type AvitoTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

const cachedTokens = new Map<
  string,
  {
    accessToken: string;
    expiresAt: number;
  }
>();

type GetAvitoAccessTokenParams = {
  clientId?: string | null;
  clientSecret?: string | null;
};

export async function getAvitoAccessToken(params: GetAvitoAccessTokenParams = {}) {
  const clientId = params.clientId || process.env.AVITO_CLIENT_ID;
  const clientSecret = params.clientSecret || process.env.AVITO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Не найдены Avito client_id/client_secret");
  }

  const cacheKey = clientId;
  const now = Date.now();
  const cachedToken = cachedTokens.get(cacheKey);

  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.accessToken;
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

  cachedTokens.set(cacheKey, {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  });

  return data.access_token;
}