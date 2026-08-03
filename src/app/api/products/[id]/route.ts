import { NextRequest, NextResponse } from "next/server";
import { productService } from "@/services/productService";
import { updateProductSchema } from "@/domain/schemas/product";
import { DomainError } from "@/domain/errors";

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/products/[id]">,
) {
  const { id } = await ctx.params;
  const body = await request.json();
  const parsed = updateProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const product = await productService.update(id, parsed.data);
    return NextResponse.json(product);
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
