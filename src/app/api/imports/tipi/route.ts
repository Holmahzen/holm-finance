import { NextRequest, NextResponse } from "next/server";
import { tipiImportService } from "@/services/tipiImportService";
import { DomainError } from "@/domain/errors";

/** O Excel da TIPI tem ~700 KB e 10 mil linhas: cabe numa requisição só. */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo é obrigatório." }, { status: 400 });
  }

  try {
    const result = await tipiImportService.importWorkbook(Buffer.from(await file.arrayBuffer()));
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}
