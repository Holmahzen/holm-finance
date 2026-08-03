import { NextRequest, NextResponse } from "next/server";
import { productService } from "@/services/productService";
import { createProductSchema } from "@/domain/schemas/product";
import { DomainError } from "@/domain/errors";

export async function GET() {
  const products = await productService.list();
  return NextResponse.json(products);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const product = await productService.create(parsed.data);
    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
