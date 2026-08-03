import { categoryRepository } from "@/repositories/categoryRepository";
import { NotFoundError, DomainError } from "@/domain/errors";
import type { CreateCategoryInput, UpdateCategoryInput } from "@/domain/schemas/category";

async function assertValidParent(parentId: string | undefined) {
  if (!parentId) return;
  const parent = await categoryRepository.findById(parentId);
  if (!parent) throw new NotFoundError("Categoria pai", parentId);
  if (parent.parentId) {
    throw new DomainError(
      "Só é possível criar subcategorias dentro de uma categoria principal (não dentro de outra subcategoria).",
    );
  }
}

export const categoryService = {
  list() {
    return categoryRepository.findMany();
  },

  async get(id: string) {
    const category = await categoryRepository.findById(id);
    if (!category) throw new NotFoundError("Categoria", id);
    return category;
  },

  async create(input: CreateCategoryInput) {
    await assertValidParent(input.parentId);
    return categoryRepository.create(input);
  },

  async update(id: string, input: UpdateCategoryInput) {
    await this.get(id);
    if (input.parentId === id) {
      throw new DomainError("Uma categoria não pode ser pai dela mesma.");
    }
    await assertValidParent(input.parentId);
    return categoryRepository.update(id, input);
  },
};
