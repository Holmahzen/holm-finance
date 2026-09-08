import { NextRequest, NextResponse } from "next/server";
import { ofxImportService } from "@/services/ofxImportService";
import { importBatchRepository } from "@/repositories/importBatchRepository";
import { DomainError } from "@/domain/errors";


/**
 * Importacao de arquivo grande leva mais que o padrao curto da Vercel: um
 * extrato de cinco semanas estourava o tempo, a funcao era morta e a tela
 * ficava presa em "Importando...". 60s e o teto do plano Hobby e cabe no Pro
 * tambem; no Pro da para subir mais se algum dia voltar a faltar.
 */
export const maxDuration = 60;

export async function GET() {
  const batches = await importBatchRepository.findMany();
  return NextResponse.json(batches);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  const bankAccountId = formData.get("bankAccountId");

  if (!(file instanceof File) || typeof bankAccountId !== "string" || !bankAccountId) {
    return NextResponse.json(
      { error: "Arquivo OFX e conta bancária são obrigatórios." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await ofxImportService.importFile(bankAccountId, file.name, buffer);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
