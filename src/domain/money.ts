import { Prisma } from "@/generated/prisma/client";

export function toDecimal(value: string | number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

export function formatBRL(value: Prisma.Decimal | string | number): string {
  const num = typeof value === "object" ? value.toNumber() : Number(value);
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
