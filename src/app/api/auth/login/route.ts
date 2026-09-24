import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  authEnv,
  clearFailures,
  createSessionToken,
  isAuthConfigured,
  isRateLimited,
  recordFailure,
  safeEqual,
  verifyPassword,
} from "@/lib/auth";

const FAIL_DELAY_MS = 600;

export async function POST(request: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.json({ error: "Login não configurado neste ambiente." }, { status: 503 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconhecido";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde 15 minutos." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const env = authEnv();
  // As duas conferências rodam sempre, pra não dar pra descobrir qual dos dois errou.
  const emailOk = safeEqual(email, env.email!);
  const passwordOk = verifyPassword(password, env.passwordHash);

  if (!emailOk || !passwordOk) {
    recordFailure(ip);
    await new Promise((resolve) => setTimeout(resolve, FAIL_DELAY_MS));
    return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
  }

  clearFailures(ip);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken(email, env.secret!), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
