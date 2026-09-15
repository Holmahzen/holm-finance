import { productRepository } from "@/repositories/productRepository";
import { marketplaceSaleRepository } from "@/repositories/marketplaceSaleRepository";
import { findNumericNamedProducts, pickSuggestedNames, type SuspiciousProduct } from "@/domain/productSuspicious";

export const productSuspiciousService = {
  async list(): Promise<SuspiciousProduct[]> {
    const products = await productRepository.findActive();
    const numericNamed = findNumericNamedProducts(products);
    if (numericNamed.length === 0) return [];

    const skus = numericNamed.map((p) => p.sku!);
    const sales = await marketplaceSaleRepository.findProductNamesBySkus(skus);
    const suggested = pickSuggestedNames(sales);

    return numericNamed.map((p) => ({
      id: p.id,
      sku: p.sku!,
      currentName: p.name,
      suggestedName: suggested.get(p.sku!) ?? null,
      salePrice: Number(p.salePrice),
      tecidoCost: Number(p.tecidoCost),
      costuraCost: Number(p.costuraCost),
      aviamentosCost: Number(p.aviamentosCost),
    }));
  },
};
