import { NextResponse } from "next/server";
import { sefazDistributionService } from "@/services/sefazDistributionService";
import { DomainError } from "@/domain/errors";

/** A consulta pode levar vários lotes; 60s é o teto do plano Hobby da Vercel. */
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json(await sefazDistributionService.getReport());
}

export async function POST() {
  try {
    return NextResponse.json(await sefazDistributionService.sync(), { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }
}
