import { NextResponse } from "next/server";
import { mercadoLivreReleaseService } from "@/services/mercadoLivreReleaseService";

export async function GET() {
  const report = await mercadoLivreReleaseService.getReport();
  return NextResponse.json(report);
}

/** Aplica os valores calculados em MercadoLivreReceivable, que alimenta a
 * projeção de fluxo de caixa e o balanço patrimonial. */
export async function POST() {
  const buckets = await mercadoLivreReleaseService.syncToReceivable();
  return NextResponse.json(buckets);
}
