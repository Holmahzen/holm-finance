import { NextRequest, NextResponse } from "next/server";
import { fixedCostService } from "@/services/fixedCostService";
import { generateFixedCostsSchema } from "@/domain/schemas/fixedCost";
import { DomainError } from "@/domain/errors";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = generateFixedCostsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { year, month, endYear, endMonth } = parsed.data;

  try {
    const result = await fixedCostService.generateForRange(
      year,
      month,
      endYear ?? year,
      endMonth ?? month,
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
