import { NextResponse } from "next/server";
import { pgdasRepository } from "@/repositories/pgdasRepository";
import { latestEffectiveRate } from "@/domain/effectiveTaxRate";

/** Alíquota efetiva do último extrato do PGDAS-D importado (null sem extrato). */
export async function GET() {
  const apuracoes = await pgdasRepository.findApuracoes("2000-01");
  return NextResponse.json(latestEffectiveRate(apuracoes));
}
