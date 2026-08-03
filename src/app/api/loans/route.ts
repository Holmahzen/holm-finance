import { NextRequest, NextResponse } from "next/server";
import { loanService } from "@/services/loanService";
import { createLoanSchema } from "@/domain/schemas/loan";
import { DomainError } from "@/domain/errors";

export async function GET() {
  const loans = await loanService.list();
  return NextResponse.json(loans);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createLoanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const loan = await loanService.create(parsed.data);
    return NextResponse.json(loan, { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
