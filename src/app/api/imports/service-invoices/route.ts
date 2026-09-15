import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serviceInvoiceImportService } from "@/services/serviceInvoiceImportService";
import { serviceInvoiceRepository } from "@/repositories/serviceInvoiceRepository";
import { DomainError } from "@/domain/errors";

export const maxDuration = 60;

export async function GET() {
  const invoices = await serviceInvoiceRepository.findMany();
  return NextResponse.json(invoices);
}

const bodySchema = z.object({
  xmlFiles: z.array(z.object({ name: z.string(), content: z.string() })).max(500).default([]),
  pdfFiles: z.array(z.object({ name: z.string(), base64: z.string() })).max(500).default([]),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Envie os XMLs ou PDFs das notas de serviço." }, { status: 400 });
  }
  if (parsed.data.xmlFiles.length === 0 && parsed.data.pdfFiles.length === 0) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }

  try {
    const result = await serviceInvoiceImportService.importFiles(parsed.data.xmlFiles, parsed.data.pdfFiles);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
