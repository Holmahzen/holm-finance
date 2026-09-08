import { NextRequest, NextResponse } from "next/server";
import { salesImportService } from "@/services/salesImportService";
import { salesImportBatchRepository } from "@/repositories/salesImportBatchRepository";
import { DomainError } from "@/domain/errors";


/**
 * Importacao de arquivo grande leva mais que o padrao curto da Vercel: um
 * extrato de cinco semanas estourava o tempo, a funcao era morta e a tela
 * ficava presa em "Importando...". 60s e o teto do plano Hobby e cabe no Pro
 * tambem; no Pro da para subir mais se algum dia voltar a faltar.
 */
export const maxDuration = 60;

export async function GET() {
  const batches = await salesImportBatchRepository.findMany();
  return NextResponse.json(batches);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo é obrigatório." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await salesImportService.importFile(file.name, buffer);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
