import { appEnv } from "@/lib/env";

type BasiqTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: "Bearer";
};

const BASIQ_VERSION = "2.1";
let cachedToken: { value: string; expiresAt: number } | null = null;

export async function basiqRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = await getBasiqAccessToken();
  const response = await fetch(`${appEnv.basiqApiUrl}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
      "basiq-version": BASIQ_VERSION,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Basiq request failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`);
  }

  return response.json() as Promise<T>;
}

async function getBasiqAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const body = new URLSearchParams({ scope: "SERVER_ACCESS" });
  const response = await fetch(`${appEnv.basiqApiUrl}/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${appEnv.basiqApiKey}`,
      "content-type": "application/x-www-form-urlencoded",
      "basiq-version": BASIQ_VERSION,
      accept: "application/json",
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Failed to authenticate with Basiq: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`);
  }

  const payload = (await response.json()) as BasiqTokenResponse;
  const expiresAt = Date.now() + Math.max((payload.expires_in - 120) * 1000, 60_000);

  cachedToken = {
    value: payload.access_token,
    expiresAt,
  };

  return payload.access_token;
}
