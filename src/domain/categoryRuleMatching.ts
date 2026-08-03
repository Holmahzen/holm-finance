export type MatchableEntry = { id: string; description: string };
export type MatchableRule = { id: string; keyword: string; categoryId: string };

export type CategoryRuleMatch = { entryId: string; categoryId: string; ruleId: string };

/**
 * Para cada lançamento, acha a primeira regra cuja palavra-chave aparece na
 * descrição (sem diferenciar maiúsculas/minúsculas). A ordem das regras
 * decide o desempate quando mais de uma bate na mesma descrição.
 */
export function matchEntriesToRules(
  entries: MatchableEntry[],
  rules: MatchableRule[],
): CategoryRuleMatch[] {
  const matches: CategoryRuleMatch[] = [];

  for (const entry of entries) {
    const rule = rules.find((r) =>
      entry.description.toUpperCase().includes(r.keyword.toUpperCase()),
    );
    if (rule) {
      matches.push({ entryId: entry.id, categoryId: rule.categoryId, ruleId: rule.id });
    }
  }

  return matches;
}
