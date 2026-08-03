import { NextRequest, NextResponse } from "next/server";
import { categoryRuleService } from "@/services/categoryRuleService";
import { createCategoryRuleSchema } from "@/domain/schemas/categoryRule";
import { DomainError } from "@/domain/errors";

export async function GET() {
  const rules = await categoryRuleService.list();
  return NextResponse.json(rules);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createCategoryRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const rule = await categoryRuleService.create(parsed.data);
    return NextResponse.json(rule, { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
