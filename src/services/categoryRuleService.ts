import { categoryRuleRepository } from "@/repositories/categoryRuleRepository";
import { entryRepository } from "@/repositories/entryRepository";
import { matchEntriesToRules } from "@/domain/categoryRuleMatching";
import type { CreateCategoryRuleInput } from "@/domain/schemas/categoryRule";

export const categoryRuleService = {
  list() {
    return categoryRuleRepository.findMany();
  },

  create(input: CreateCategoryRuleInput) {
    return categoryRuleRepository.create(input);
  },

  remove(id: string) {
    return categoryRuleRepository.delete(id);
  },

  async applyToExistingEntries() {
    const [rules, entries] = await Promise.all([
      categoryRuleRepository.findMany(),
      entryRepository.findMany({ categoryId: null }),
    ]);

    const matches = matchEntriesToRules(
      entries.map((e) => ({ id: e.id, description: e.description })),
      rules.map((r) => ({ id: r.id, keyword: r.keyword, categoryId: r.categoryId })),
    );

    for (const match of matches) {
      await entryRepository.update(match.entryId, { categoryId: match.categoryId });
    }

    const categoryNameByRuleId = new Map(rules.map((r) => [r.id, r.category.name]));
    const breakdownMap = new Map<string, number>();
    for (const match of matches) {
      const name = categoryNameByRuleId.get(match.ruleId) ?? "—";
      breakdownMap.set(name, (breakdownMap.get(name) ?? 0) + 1);
    }

    return {
      checked: entries.length,
      updated: matches.length,
      breakdown: Array.from(breakdownMap, ([categoryName, count]) => ({ categoryName, count })),
    };
  },
};
