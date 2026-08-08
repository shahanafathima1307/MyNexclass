import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/** Lovable AI Gateway provider — server-only, the API key never leaves the server. */
export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
  });
}
