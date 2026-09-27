import { expect, test } from '@playwright/test'
import {
  createAcknowledgementClock,
  dismissAcknowledgement,
  enqueueAcknowledgement,
  resizeAcknowledgementClock,
  setAcknowledgementPause,
  tickAcknowledgements,
} from '@/lib/toast/v3-acknowledgement-clock'

test('uses verified Round 07 lifetimes only after display, with FIFO queued time free', () => {
  let clock = createAcknowledgementClock(1)
  clock = enqueueAcknowledgement(clock, { id: 'a', variant: 'success', title: 'Creado' }, 100)
  clock = enqueueAcknowledgement(clock, { id: 'b', variant: 'warning', title: 'Revisar' }, 100)
  expect(clock.items.map(item => [item.phase, item.remaining])).toEqual([['visible', 4200], ['queued', 6200]])
  clock = tickAcknowledgements(clock, 4300)
  expect(clock.items[0]).toMatchObject({ phase: 'closing', remaining: 0 })
  expect(clock.items[1]).toMatchObject({ phase: 'queued', remaining: 6200 })
  clock = tickAcknowledgements(clock, 4450)
  expect(clock.items).toHaveLength(1)
  expect(clock.items[0]).toMatchObject({ id: 'b', phase: 'visible', remaining: 6200 })
  clock = tickAcknowledgements(clock, 10649)
  expect(clock.items[0]).toMatchObject({ phase: 'visible', remaining: 1 })
})

test('overlapping pause reasons freeze and resume the same monotonic remainder', () => {
  let clock = enqueueAcknowledgement(createAcknowledgementClock(2), { id: 'a', variant: 'error', title: 'Error' }, 0)
  clock = setAcknowledgementPause(clock, 'a', 'hover', true, 1200)
  clock = setAcknowledgementPause(clock, 'a', 'focus', true, 1300)
  clock = setAcknowledgementPause(clock, 'a', 'hover', false, 5000)
  expect(clock.items[0]).toMatchObject({ remaining: 7000, pauseReasons: ['focus'] })
  clock = tickAcknowledgements(clock, 7000)
  expect(clock.items[0]?.remaining).toBe(7000)
  clock = setAcknowledgementPause(clock, 'a', 'focus', false, 7000)
  clock = tickAcknowledgements(clock, 8000)
  expect(clock.items[0]?.remaining).toBe(6000)
})

test('identical keyed content refreshes itself, but another outcome for the same record stays distinct', () => {
  let clock = enqueueAcknowledgement(createAcknowledgementClock(2), {
    id: 'a', key: 'edit:42', variant: 'success', title: 'Editado', detail: 'Cuenta',
  }, 0)
  clock = tickAcknowledgements(clock, 2000)
  clock = enqueueAcknowledgement(clock, {
    id: 'duplicate', key: 'edit:42', variant: 'success', title: 'Editado', detail: 'Cuenta',
  }, 2000)
  expect(clock.items).toHaveLength(1)
  expect(clock.items[0]).toMatchObject({ id: 'a', remaining: 4200 })
  clock = enqueueAcknowledgement(clock, {
    id: 'error', key: 'edit:42', variant: 'error', title: 'No se guardó', detail: 'Cuenta',
  }, 2100)
  expect(clock.items.map(item => item.id)).toEqual(['a', 'error'])
})

test('mobile/desktop capacity changes preserve remaining time, and explicit dismissal keeps the exit slot', () => {
  let clock = createAcknowledgementClock(2)
  clock = enqueueAcknowledgement(clock, { id: 'a', variant: 'info', title: 'Uno' }, 0)
  clock = enqueueAcknowledgement(clock, { id: 'b', variant: 'info', title: 'Dos' }, 0)
  clock = tickAcknowledgements(clock, 1000)
  clock = resizeAcknowledgementClock(clock, 1, 1000)
  expect(clock.items.map(item => [item.phase, item.remaining])).toEqual([['visible', 3200], ['queued', 3200]])
  clock = tickAcknowledgements(clock, 2000)
  expect(clock.items[1]?.remaining).toBe(3200)
  clock = dismissAcknowledgement(clock, 'a', 2000)
  expect(clock.items[0]?.phase).toBe('closing')
  clock = tickAcknowledgements(clock, 2150)
  expect(clock.items[0]).toMatchObject({ id: 'b', phase: 'visible', remaining: 3200 })
})

test('dismissing a queued message removes it without occupying a visible slot', () => {
  let clock = createAcknowledgementClock(1)
  clock = enqueueAcknowledgement(clock, { id: 'visible', variant: 'info', title: 'Visible' }, 0)
  clock = enqueueAcknowledgement(clock, { id: 'queued', variant: 'error', title: 'Pendiente' }, 0)
  clock = dismissAcknowledgement(clock, 'queued', 100)
  expect(clock.items.map(item => item.id)).toEqual(['visible'])
})

test('a queued acknowledgement keeps document-hidden pause when it becomes visible', () => {
  let clock = createAcknowledgementClock(1)
  clock = enqueueAcknowledgement(clock, { id: 'first', variant: 'success', title: 'Primero' }, 0)
  clock = enqueueAcknowledgement(clock, { id: 'second', variant: 'success', title: 'Segundo' }, 0)
  clock = setAcknowledgementPause(clock, 'second', 'hidden', true, 10)
  clock = dismissAcknowledgement(clock, 'first', 100)
  clock = tickAcknowledgements(clock, 250)
  expect(clock.items[0]).toMatchObject({ id: 'second', phase: 'visible', remaining: 4200, pauseReasons: ['hidden'] })
  clock = tickAcknowledgements(clock, 10000)
  expect(clock.items[0]?.remaining).toBe(4200)
  clock = setAcknowledgementPause(clock, 'second', 'hidden', false, 10000)
  clock = tickAcknowledgements(clock, 10100)
  expect(clock.items[0]?.remaining).toBe(4100)
})
