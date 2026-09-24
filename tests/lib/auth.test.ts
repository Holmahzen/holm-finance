import { describe, it, expect } from "vitest";
import {
  createSessionToken,
  hashPassword,
  isRateLimited,
  readSessionToken,
  recordFailure,
  safeEqual,
  safeNextPath,
  verifyPassword,
} from "@/lib/auth";

const SECRET = "s".repeat(40);

describe("senha", () => {
  it("aceita a senha certa e rejeita a errada", () => {
    const hash = hashPassword("uma-senha-bem-longa-123");
    expect(verifyPassword("uma-senha-bem-longa-123", hash)).toBe(true);
    expect(verifyPassword("uma-senha-bem-longa-124", hash)).toBe(false);
  });

  it("o mesmo texto gera hashes diferentes (salt)", () => {
    expect(hashPassword("abc")).not.toBe(hashPassword("abc"));
  });

  it("hash ausente ou malformado nunca autentica", () => {
    expect(verifyPassword("qualquer", undefined)).toBe(false);
    expect(verifyPassword("qualquer", "")).toBe(false);
    expect(verifyPassword("qualquer", "scrypt:lixo")).toBe(false);
  });
});

describe("safeEqual", () => {
  it("compara sem depender do tamanho", () => {
    expect(safeEqual("a@b.com", "a@b.com")).toBe(true);
    expect(safeEqual("a@b.com", "a@b.co")).toBe(false);
    expect(safeEqual("", "x")).toBe(false);
  });
});

describe("sessão", () => {
  it("token válido é lido de volta", () => {
    expect(readSessionToken(createSessionToken("eu@x.com", SECRET), SECRET)).toEqual({ sub: "eu@x.com" });
  });

  it("rejeita segredo diferente", () => {
    expect(readSessionToken(createSessionToken("eu@x.com", SECRET), "outro".repeat(10))).toBeNull();
  });

  it("rejeita token adulterado", () => {
    const token = createSessionToken("eu@x.com", SECRET);
    const [payload, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "invasor@x.com", exp: 9999999999 })).toString("base64url");
    expect(readSessionToken(`${forged}.${sig}`, SECRET)).toBeNull();
    expect(readSessionToken(`${payload}.${sig}x`, SECRET)).toBeNull();
    expect(readSessionToken(`${payload}.${sig}.extra`, SECRET)).toBeNull();
  });

  it("rejeita token expirado", () => {
    const token = createSessionToken("eu@x.com", SECRET, Date.now() - 8 * 24 * 60 * 60 * 1000);
    expect(readSessionToken(token, SECRET)).toBeNull();
  });

  it("sem token ou sem segredo configurado, nunca autentica", () => {
    expect(readSessionToken(undefined, SECRET)).toBeNull();
    expect(readSessionToken(createSessionToken("eu@x.com", SECRET), undefined)).toBeNull();
    expect(readSessionToken("lixo", SECRET)).toBeNull();
  });
});

describe("safeNextPath", () => {
  it("aceita só caminho interno", () => {
    expect(safeNextPath("/fluxo-de-caixa?x=1")).toBe("/fluxo-de-caixa?x=1");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});

describe("freio de tentativas", () => {
  it("trava depois de 5 falhas e libera depois de 15 minutos", () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) recordFailure("1.2.3.4", now);
    expect(isRateLimited("1.2.3.4", now + 1000)).toBe(true);
    expect(isRateLimited("1.2.3.4", now + 16 * 60 * 1000)).toBe(false);
    expect(isRateLimited("9.9.9.9", now)).toBe(false);
  });
});
