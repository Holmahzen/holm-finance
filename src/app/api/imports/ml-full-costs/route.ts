import { NextRequest, NextResponse } from "next/server";
import { mlFullCostImportService } from "@/services/mlFullCostImportService";
import { mlFullCostImportBatchRepository } from "@/repositories/mlFullCostImportBatchRepository";
import { DomainError } from "@/domain/errors";

export const maxDuration = 60;

export async function GET() {
  const batches = await mlFullCostImportBatchRepository.findMany();
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
    const result = await mlFullCostImportService.importFile(file.name, buffer);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
