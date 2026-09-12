import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { scannedNoteKeyService } from "@/services/scannedNoteKeyService";
import { DomainError } from "@/domain/errors";

const bodySchema = z.object({ key: z.string().min(1).max(120) });

export async function GET() {
  return NextResponse.json(await scannedNoteKeyService.listPending());
}

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Bipe ou digite a chave de acesso." }, { status: 400 });
  }
  try {
    return NextResponse.json(await scannedNoteKeyService.register(parsed.data.key), { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function DELETE(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Informe a chave." }, { status: 400 });
  }
  await scannedNoteKeyService.forget(parsed.data.key);
  return NextResponse.json({ ok: true });
}
