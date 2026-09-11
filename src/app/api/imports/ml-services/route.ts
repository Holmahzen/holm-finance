import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { mlServiceImportService } from "@/services/mlServiceImportService";
import { DomainError } from "@/domain/errors";

/** Mesmo esquema das notas: o navegador abre o .zip e manda os PDFs em lotes de ~2 MB. */
export const maxDuration = 60;

const bodySchema = z.object({
  files: z
    .array(z.object({ name: z.string(), base64: z.string() }))
    .min(1)
    .max(500),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Envie os PDFs dos demonstrativos." }, { status: 400 });
  }

  try {
    const result = await mlServiceImportService.importPdfFiles(parsed.data.files);
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
