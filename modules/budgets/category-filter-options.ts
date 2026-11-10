export type BudgetCategoryFilterSource = {
  category?: { id: string; name: string } | null
}

export function getBudgetCategoryFilterOptions<T extends BudgetCategoryFilterSource>(
  budgets: readonly T[],
): Array<{ id: string; name: string }> {
  const options = new Map<string, string>()
  for (const budget of budgets) {
    const category = budget.category
    if (category?.id && category.name) options.set(category.id, category.name)
  }

  return [...options.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name, 'es'))
}
