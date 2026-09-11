import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fiscalNoteImportService } from "@/services/fiscalNoteImportService";
import { DomainError } from "@/domain/errors";

/**
 * O navegador abre o .zip e manda os XMLs em lotes de ~2 MB (o limite de corpo
 * da Vercel é 4,5 MB), então cada chamada é curta; 60s é o teto do plano Hobby.
 */
export const maxDuration = 60;

const bodySchema = z.object({
  files: z
    .array(z.object({ name: z.string(), content: z.string() }))
    .min(1)
    .max(2000),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Envie os XMLs das notas." }, { status: 400 });
  }

  try {
    const result = await fiscalNoteImportService.importXmlFiles(parsed.data.files);
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
