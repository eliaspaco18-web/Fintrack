export type AcknowledgementVariant = 'success' | 'info' | 'warning' | 'error'
export type AcknowledgementPhase = 'queued' | 'visible' | 'closing'
export type AcknowledgementPauseReason = 'hover' | 'focus' | 'hold' | 'hidden'

export interface Acknowledgement {
  id: string
  key?: string
  variant: AcknowledgementVariant
  title: string
  detail?: string
  duration: number
  remaining: number
  phase: AcknowledgementPhase
  lastTick: number | null
  closingAt: number | null
  pauseReasons: AcknowledgementPauseReason[]
}

export interface AcknowledgementClock {
  items: Acknowledgement[]
  visibleLimit: 1 | 2
}

export interface AcknowledgementInput {
  id: string
  key?: string
  variant: AcknowledgementVariant
  title: string
  detail?: string
  duration?: number
}

export const ACKNOWLEDGEMENT_EXIT_MS = 150

export function acknowledgementDuration(variant: AcknowledgementVariant): number {
  if (variant === 'error') return 8200
  if (variant === 'warning') return 6200
  return 4200
}

export function createAcknowledgementClock(visibleLimit: 1 | 2): AcknowledgementClock {
  return { items: [], visibleLimit }
}

function promote(clock: AcknowledgementClock, now: number): AcknowledgementClock {
  let visibleCount = clock.items.filter(item => item.phase === 'visible' || item.phase === 'closing').length
  return {
    ...clock,
    items: clock.items.map(item => {
      if (item.phase !== 'queued' || visibleCount >= clock.visibleLimit) return item
      visibleCount += 1
      return { ...item, phase: 'visible', lastTick: now }
    }),
  }
}

export function tickAcknowledgements(clock: AcknowledgementClock, now: number): AcknowledgementClock {
  const items = clock.items.flatMap(item => {
    if (item.phase === 'queued') return [item]
    if (item.phase === 'closing') {
      return item.closingAt !== null && now - item.closingAt >= ACKNOWLEDGEMENT_EXIT_MS ? [] : [item]
    }
    if (item.duration === 0 || item.pauseReasons.length > 0) {
      return [{ ...item, lastTick: now }]
    }
    const elapsed = Math.max(0, now - (item.lastTick ?? now))
    const remaining = Math.max(0, item.remaining - elapsed)
    if (remaining === 0) {
      return [{ ...item, remaining: 0, phase: 'closing' as const, closingAt: now, lastTick: now }]
    }
    return [{ ...item, remaining, lastTick: now }]
  })
  return promote({ ...clock, items }, now)
}

export function enqueueAcknowledgement(
  clock: AcknowledgementClock,
  input: AcknowledgementInput,
  now: number,
): AcknowledgementClock {
  const current = tickAcknowledgements(clock, now)
  const duration = input.duration ?? acknowledgementDuration(input.variant)
  if (!Number.isFinite(duration) || duration < 0) throw new RangeError('Invalid acknowledgement duration')

  if (input.key) {
    const duplicate = current.items.find(item =>
      item.phase !== 'closing' && item.key === input.key && item.variant === input.variant &&
      item.title === input.title && item.detail === input.detail,
    )
    if (duplicate) {
      return {
        ...current,
        items: current.items.map(item => item.id === duplicate.id
          ? { ...item, duration, remaining: duration, lastTick: item.phase === 'visible' ? now : null }
          : item),
      }
    }
  }

  return promote({
    ...current,
    items: [...current.items, {
      ...input, duration, remaining: duration, phase: 'queued',
      lastTick: null, closingAt: null, pauseReasons: [],
    }],
  }, now)
}

export function setAcknowledgementPause(
  clock: AcknowledgementClock,
  id: string,
  reason: AcknowledgementPauseReason,
  paused: boolean,
  now: number,
): AcknowledgementClock {
  const current = tickAcknowledgements(clock, now)
  return {
    ...current,
    items: current.items.map(item => {
      if (item.id !== id || item.phase === 'closing') return item
      const reasons = new Set(item.pauseReasons)
      if (paused) reasons.add(reason)
      else reasons.delete(reason)
      return { ...item, pauseReasons: [...reasons], lastTick: now }
    }),
  }
}

export function dismissAcknowledgement(clock: AcknowledgementClock, id: string, now: number): AcknowledgementClock {
  const current = tickAcknowledgements(clock, now)
  return promote({
    ...current,
    items: current.items.filter(item => !(item.id === id && item.phase === 'queued')).map(item => item.id === id
      ? { ...item, phase: 'closing', closingAt: now, lastTick: now }
      : item),
  }, now)
}

export function resizeAcknowledgementClock(
  clock: AcknowledgementClock,
  visibleLimit: 1 | 2,
  now: number,
): AcknowledgementClock {
  const current = tickAcknowledgements(clock, now)
  let visibleCount = 0
  const items = current.items.map(item => {
    if (item.phase === 'closing') {
      visibleCount += 1
      return item
    }
    if (item.phase !== 'visible') return item
    visibleCount += 1
    if (visibleCount <= visibleLimit) return item
    return { ...item, phase: 'queued' as const, lastTick: null }
  })
  return promote({ items, visibleLimit }, now)
}
