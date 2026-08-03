import { NextRequest, NextResponse } from "next/server";
import { excelImportService } from "@/services/excelImportService";
import { DomainError } from "@/domain/errors";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  const bankAccountId = formData.get("bankAccountId");

  if (!(file instanceof File) || typeof bankAccountId !== "string" || !bankAccountId) {
    return NextResponse.json(
      { error: "Arquivo Excel e conta bancária são obrigatórios." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await excelImportService.importFile(bankAccountId, file.name, buffer);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
