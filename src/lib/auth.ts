import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Login do Holm Finance: uma conta só, definida por variáveis de ambiente
 * (ADMIN_EMAIL, ADMIN_PASSWORD_HASH, SESSION_SECRET) — nada de senha no código
 * nem no banco. Sessão = cookie httpOnly assinado com HMAC-SHA256.
 * Sem dependência externa de propósito: é pouco código e fácil de auditar.
 */

export const SESSION_COOKIE = "hf_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

// Separador ":" (não "$"): arquivos .env expandem "$algo" como variável e corromperiam o hash.
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return ["scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString("base64"), hash.toString("base64")].join(":");
}

export function verifyPassword(password: string, stored: string | undefined): boolean {
  // Sempre gasta o mesmo tempo, mesmo sem hash válido, pra não revelar nada pela demora.
  const parts = (stored ?? "").split(":");
  const valid = parts.length === 6 && parts[0] === "scrypt";
  const salt = Buffer.from(valid ? parts[4] : "AAAAAAAAAAAAAAAAAAAAAA==", "base64");
  const expected = Buffer.from(valid ? parts[5] : "A".repeat(KEY_LENGTH), "base64");
  const n = valid ? Number(parts[1]) : SCRYPT_N;
  const r = valid ? Number(parts[2]) : SCRYPT_R;
  const p = valid ? Number(parts[3]) : SCRYPT_P;

  const actual = scryptSync(password, salt, expected.length, { N: n, r, p });
  return valid && actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function safeEqual(a: string, b: string): boolean {
  const ha = createHmac("sha256", "cmp").update(a).digest();
  const hb = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(email: string, secret: string, now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: email, exp: Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS }),
  ).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function readSessionToken(
  token: string | undefined,
  secret: string | undefined,
  now = Date.now(),
): { sub: string } | null {
  if (!token || !secret) return null;
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length > 0) return null;

  const expected = sign(payload, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: string; exp?: number };
    if (typeof data.sub !== "string" || typeof data.exp !== "number") return null;
    if (data.exp * 1000 < now) return null;
    return { sub: data.sub };
  } catch {
    return null;
  }
}

export function authEnv() {
  return {
    email: process.env.ADMIN_EMAIL?.trim().toLowerCase(),
    passwordHash: process.env.ADMIN_PASSWORD_HASH,
    secret: process.env.SESSION_SECRET,
  };
}

export function isAuthConfigured(): boolean {
  const { email, passwordHash, secret } = authEnv();
  return Boolean(email && passwordHash && secret && secret.length >= 32);
}

/**
 * Só o `next dev` local, sem login configurado, deixa passar — pra não travar
 * quem roda o sistema no próprio PC. Produção (Vercel ou `next start`) nunca:
 * sem configuração completa, tudo fica bloqueado.
 */
export function isDevBypass(): boolean {
  return process.env.NODE_ENV === "development" && !isAuthConfigured();
}

export { safeNextPath } from "@/lib/auth-path";

/* Freio de tentativas por IP. Em serverless a memória é por instância, então é
   só uma camada extra, não a defesa principal (a principal é a senha forte + scrypt). */
const failures = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

export function isRateLimited(key: string, now = Date.now()): boolean {
  const f = failures.get(key);
  if (!f) return false;
  if (now - f.first > WINDOW_MS) {
    failures.delete(key);
    return false;
  }
  return f.count >= MAX_FAILURES;
}

export function recordFailure(key: string, now = Date.now()): void {
  const f = failures.get(key);
  if (!f || now - f.first > WINDOW_MS) failures.set(key, { count: 1, first: now });
  else f.count += 1;
}

export function clearFailures(key: string): void {
  failures.delete(key);
}
