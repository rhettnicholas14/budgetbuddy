import { appEnv, hasOpenAiEnv } from "@/lib/env";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

export async function generateJson<T>({
  system,
  prompt,
}: {
  system: string;
  prompt: string;
}): Promise<T | null> {
  if (!hasOpenAiEnv()) {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${appEnv.openAiApiKey}`,
    },
    body: JSON.stringify({
      model: appEnv.openAiModel,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as ChatCompletionResponse;
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    return null;
  }

  return JSON.parse(content) as T;
}
