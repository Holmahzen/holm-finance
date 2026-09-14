import { NextRequest, NextResponse } from "next/server";
import { dreCompetenciaService } from "@/services/dreCompetenciaService";

/** Monta a DRE de caixa de vários meses para a tabela mês a mês. */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const month = new URL(request.url).searchParams.get("month");
  const report = await dreCompetenciaService.getReport(
    month && /^\d{4}-\d{2}$/.test(month) ? month : undefined,
  );
  return NextResponse.json(report);
}
