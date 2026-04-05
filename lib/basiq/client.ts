import { appEnv } from "@/lib/env";

export async function basiqRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${appEnv.basiqApiUrl}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Basic ${appEnv.basiqApiKey}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Basiq request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}
