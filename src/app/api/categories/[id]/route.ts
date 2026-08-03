import { NextRequest, NextResponse } from "next/server";
import { categoryService } from "@/services/categoryService";
import { updateCategorySchema } from "@/domain/schemas/category";
import { DomainError } from "@/domain/errors";

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/categories/[id]">,
) {
  const { id } = await ctx.params;
  const body = await request.json();
  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const category = await categoryService.update(id, parsed.data);
    return NextResponse.json(category);
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
