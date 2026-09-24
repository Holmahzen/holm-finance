/** Só aceita caminho interno ("/x"), nunca URL externa ou "//x" — evita redirect aberto após o login. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
