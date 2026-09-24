import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, authEnv, isDevBypass, readSessionToken } from "@/lib/auth";

/**
 * Porteiro de TODAS as rotas (páginas e API). Sem sessão válida: páginas vão
 * pro /login, API responde 401. Sem login configurado o acesso fica fechado
 * (exceto `next dev` local — ver isDevBypass).
 *
 * Fora do porteiro, de propósito: a própria tela/rota de login e o cron da
 * Vercel, que não tem cookie e se autentica sozinho por Bearer (CRON_SECRET).
 */
const PUBLIC_EXACT = new Set(["/login", "/api/auth/login", "/api/auth/logout"]);
const PUBLIC_PREFIXES = ["/api/cron/"];

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  if (isDevBypass()) return NextResponse.next();

  const session = readSessionToken(req.cookies.get(SESSION_COOKIE)?.value, authEnv().secret);
  if (session) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const url = new URL("/login", req.nextUrl);
  if (pathname !== "/") url.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

// Tudo, inclusive /api — só ficam de fora os arquivos estáticos do próprio Next.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
