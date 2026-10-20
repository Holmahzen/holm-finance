import { NextRequest, NextResponse } from "next/server";
import { mlBillingService } from "@/services/mlBillingService";
import { DomainError } from "@/domain/errors";

export async function GET() {
  return NextResponse.json(await mlBillingService.list());
}

/** Recebe o RESUMO do relatório (o arquivo, de ~5 MB, é lido no navegador). */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  try {
    const result = await mlBillingService.save(body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
