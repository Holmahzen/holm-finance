import { safeEqual } from "@/lib/auth";

/**
 * O MCP não usa o cookie de login (quem chama é o Claude, não o navegador):
 * autentica por `Authorization: Bearer <MCP_TOKEN>`. Sem MCP_TOKEN configurado,
 * ou curto demais, o endpoint fica fechado.
 */
export const MCP_TOKEN_MIN_LENGTH = 32;

export function isMcpAuthorized(authorization: string | null, token: string | undefined): boolean {
  if (!token || token.length < MCP_TOKEN_MIN_LENGTH) return false;
  const match = /^Bearer (.+)$/.exec(authorization ?? "");
  return match !== null && safeEqual(match[1], token);
}
