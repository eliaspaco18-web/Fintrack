'use client'

import Link from 'next/link'

type RankingBase = {
  key: string
  name: string
  amount: number | null
  formattedAmount: string
  shareLabel: string
}

export type CategoryRankingRow =
  | (RankingBase & { kind: 'category'; categoryId: string; href: string })
  | (RankingBase & { kind: 'aggregate'; onInspect: () => void })

/** Only bar geometry is derived here. Amount/share/route identity belong to the verified source. */
export function rankingBarPercent(amount: number | null, largest: number): number {
  if (amount === null || !Number.isFinite(amount) || amount < 0 || largest <= 0) return 0
  return Math.min(100, amount / largest * 100)
}

export function CategoryRanking({
  rows,
  label = 'Categorías del período',
}: {
  rows: readonly CategoryRankingRow[]
  label?: string
}) {
  const largest = Math.max(0, ...rows.map(row =>
    row.amount !== null && Number.isFinite(row.amount) && row.amount >= 0 ? row.amount : 0))

  return (
    <ol className="ft-v3-category-ranking" aria-label={label}>
      {rows.map((row, index) => {
        const content = (
          <>
            <span className="ft-v3-category-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <span className="ft-v3-category-content">
              <span className="ft-v3-category-main">
                <span className="ft-v3-category-name">{row.name}</span>
                <span className="ft-v3-category-amount">{row.formattedAmount}</span>
              </span>
              <span className="ft-v3-category-bottom">
                <span className="ft-v3-category-track" aria-hidden="true">
                  <span style={{ width: `${rankingBarPercent(row.amount, largest)}%` }} />
                </span>
                <span className="ft-v3-category-share">{row.shareLabel}</span>
              </span>
            </span>
          </>
        )
        const name = `${row.name}, ${row.formattedAmount}, ${row.shareLabel}`
        return (
          <li key={`${row.kind}:${row.key}`}>
            {row.kind === 'category' ? (
              <Link href={row.href} className="ft-v3-category-row" aria-label={name} data-category-id={row.categoryId}>
                {content}
              </Link>
            ) : (
              <button type="button" className="ft-v3-category-row" aria-label={`Ver desglose de ${name}`} onClick={row.onInspect}>
                {content}
              </button>
            )}
          </li>
        )
      })}
    </ol>
  )
}
