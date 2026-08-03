import { NextRequest, NextResponse } from "next/server";
import { parseBoletoPdf } from "@/parsers/boleto/boletoParser";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo é obrigatório." }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Envie um arquivo PDF." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseBoletoPdf(buffer);
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível ler o boleto.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
