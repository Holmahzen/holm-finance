import { NextRequest, NextResponse } from "next/server";
import { categoryService } from "@/services/categoryService";
import { createCategorySchema } from "@/domain/schemas/category";
import { DomainError } from "@/domain/errors";

export async function GET() {
  const categories = await categoryService.list();
  return NextResponse.json(categories);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const category = await categoryService.create(parsed.data);
    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
