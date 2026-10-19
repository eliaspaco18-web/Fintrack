'use client'

import { useEffect, useState, type ReactNode } from 'react'
import styles from './DashboardRound07.module.css'

export type DashboardSkeletonKind = 'summary' | 'flow' | 'ranking' | 'recent' | 'agenda' | 'budgets' | 'credits'

function SkeletonLine({ width = '100%', height = 12 }: { width?: string; height?: number }) {
  return <span className={styles.skeletonLine} style={{ width, height }} aria-hidden="true" />
}

function DashboardSourceSkeleton({ kind }: { kind: DashboardSkeletonKind }) {
  if (kind === 'summary') return <div className={styles.facts} aria-hidden="true">
    {[0, 1, 2].map(index => <div key={index} className={index === 2 ? styles.resultFact : undefined}><SkeletonLine width="58%" height={11} /><SkeletonLine width={index === 2 ? '84%' : '72%'} height={27} /></div>)}
  </div>
  if (kind === 'flow') return <div className={styles.flowSkeleton} aria-hidden="true">
    <div className={styles.flowSkeletonPlot}>{[34, 56, 42, 72, 48, 64].map((height, index) => <span key={index} style={{ height }} />)}</div>
    <SkeletonLine width="38%" height={11} />
    <SkeletonLine width="68%" height={10} />
  </div>
  if (kind === 'ranking') return <div className={styles.rankingSkeleton} aria-hidden="true">
    {[0, 1, 2, 3, 4].map(index => <div key={index}><SkeletonLine width={`${54 + (index % 3) * 12}%`} height={12} /><SkeletonLine width="100%" height={5} /></div>)}
  </div>
  if (kind === 'recent') return <div className={styles.listSkeleton} aria-hidden="true">
    {[0, 1, 2, 3, 4].map(index => <div key={index}><SkeletonLine width="34px" height={11} /><div><SkeletonLine width={`${68 + (index % 2) * 12}%`} height={12} /><SkeletonLine width="44%" height={10} /></div><SkeletonLine width="68px" height={12} /></div>)}
  </div>
  if (kind === 'agenda') return <div className={styles.agendaSkeleton} aria-hidden="true">
    {[0, 1, 2, 3].map(index => <div key={index}><SkeletonLine width="34px" height={38} /><SkeletonLine width={`${58 + (index % 2) * 12}%`} height={12} /><SkeletonLine width="64px" height={12} /></div>)}
  </div>
  if (kind === 'budgets') return <div className={styles.budgetSkeleton} aria-hidden="true">
    {[0, 1, 2].map(index => <div key={index}><SkeletonLine width="64%" height={12} /><SkeletonLine width="100%" height={7} /><SkeletonLine width="82%" height={10} /></div>)}
  </div>
  return <div className={styles.creditSkeleton} aria-hidden="true">
    <div className={styles.creditSkeletonHeading}><SkeletonLine width="48%" height={15} /><SkeletonLine width="28%" height={11} /></div>
    {[0, 1].map(index => <div key={index}><SkeletonLine width="57%" height={13} /><SkeletonLine width="68px" height={14} /><SkeletonLine width="100%" height={6} /></div>)}
  </div>
}

export function DashboardSourceState({ loading, failed, available, retry, skeleton, regionClassName = '', children }: {
  loading: boolean
  failed: boolean
  available: boolean
  retry: () => void
  skeleton: DashboardSkeletonKind
  regionClassName?: string
  children: ReactNode
}) {
  const [skeletonVisible, setSkeletonVisible] = useState(false)

  useEffect(() => {
    if (!loading) {
      setSkeletonVisible(false)
      return
    }
    const timeout = window.setTimeout(() => setSkeletonVisible(true), 120)
    return () => window.clearTimeout(timeout)
  }, [loading])

  const regionClass = `${styles.sourceRegion} ${regionClassName}`.trim()
  if (failed && !available) return <div className={`${styles.sourceState} ${regionClass}`} role="alert">No se pudo cargar esta sección. <button type="button" onClick={retry}>Reintentar</button></div>
  if (loading) return <div className={regionClass} role="status" aria-busy="true"><div className={styles.sourceSkeleton} data-visible={skeletonVisible ? 'true' : 'false'}><DashboardSourceSkeleton kind={skeleton} /></div></div>
  return <div className={`${regionClass} ${styles.sourceReady}`}>{failed ? <div className={styles.stale} role="status">No se pudo actualizar; se muestran los últimos datos disponibles. <button type="button" onClick={retry}>Reintentar</button></div> : null}{children}</div>
}
