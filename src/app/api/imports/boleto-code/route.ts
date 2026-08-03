import { NextRequest, NextResponse } from "next/server";
import { parseBoletoCode } from "@/domain/boletoBarcode";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const code = typeof body.code === "string" ? body.code : "";

  if (!code.trim()) {
    return NextResponse.json(
      { error: "Cole a linha digitável ou o código de barras do boleto." },
      { status: 400 },
    );
  }

  try {
    const parsed = parseBoletoCode(code);
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível ler o código.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
