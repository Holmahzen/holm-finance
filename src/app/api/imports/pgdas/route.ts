import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pgdasImportService } from "@/services/pgdasImportService";
import { DomainError } from "@/domain/errors";

/** Cada extrato tem ~10 KB; mesmo um ano inteiro cabe folgado numa requisição. */
export const maxDuration = 60;

const bodySchema = z.object({
  files: z
    .array(z.object({ name: z.string(), base64: z.string() }))
    .min(1)
    .max(60),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Envie os PDFs dos extratos do Simples Nacional." }, { status: 400 });
  }

  try {
    return NextResponse.json(await pgdasImportService.importPdfFiles(parsed.data.files), { status: 201 });
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
