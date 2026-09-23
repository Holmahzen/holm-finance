import { NextRequest, NextResponse } from "next/server";
import { mercadoLivreReleaseService } from "@/services/mercadoLivreReleaseService";

/**
 * Roda 1x por dia (vercel.json) e aplica os 4 baldes de recebíveis do
 * Mercado Livre calculados a partir do hub, exatamente como o botão
 * "Aplicar na projeção" em /recebiveis-ml — só que sozinho, porque "hoje"
 * muda todo dia e o valor salvo fica velho se ninguém reaplicar.
 *
 * Protegido do mesmo jeito que a Vercel recomenda pros próprios cron jobs:
 * ela manda esse bearer sozinha quando CRON_SECRET está configurado.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ erro: "CRON_SECRET não configurado" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const buckets = await mercadoLivreReleaseService.syncToReceivable();
  return NextResponse.json({ ok: true, buckets });
}
