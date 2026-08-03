import { NextRequest, NextResponse } from "next/server";
import { accountService } from "@/services/accountService";
import { createAccountSchema } from "@/domain/schemas/account";
import { DomainError } from "@/domain/errors";

export async function GET() {
  const accounts = await accountService.list();
  return NextResponse.json(accounts);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const account = await accountService.create(parsed.data);
    return NextResponse.json(account, { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
