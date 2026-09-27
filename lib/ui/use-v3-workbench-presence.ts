'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'

export type V3WorkbenchPhase = 'closed' | 'opening' | 'open' | 'closing'
export type V3WorkbenchMotionSource = 'pointer' | 'keyboard'

interface PresenceResult {
  mounted: boolean
  phase: V3WorkbenchPhase
  frameRef: RefObject<HTMLDivElement>
  veilRef: RefObject<HTMLDivElement>
  bodyRef: RefObject<HTMLDivElement>
}

interface Pose { transform: string; opacity: string }

const ENTER_FRAME: Pose = { transform: 'translateX(48px) scale(.985)', opacity: '.82' }
const EXIT_FRAME: Pose = { transform: 'translateX(24px) scale(.992)', opacity: '0' }
const REST_FRAME: Pose = { transform: 'none', opacity: '1' }
const ENTER_BODY: Pose = { transform: 'translateY(8px)', opacity: '.65' }
const REST_BODY: Pose = { transform: 'none', opacity: '1' }

function poseOf(element: HTMLElement): Pose {
  const style = getComputedStyle(element)
  return { transform: style.transform, opacity: style.opacity }
}

function clearPose(element: HTMLElement | null) {
  if (!element) return
  element.style.removeProperty('transform')
  element.style.removeProperty('opacity')
}

function cancelAtCurrentPose(animation: Animation | null, element: HTMLElement | null): Pose | null {
  if (!animation || !element) return null
  const pose = poseOf(element)
  animation.cancel()
  element.style.transform = pose.transform
  element.style.opacity = pose.opacity
  return pose
}

/** Visual presence only. The caller still owns every dirty/busy/unknown-result close guard. */
export function useV3WorkbenchPresence(
  open: boolean,
  ready: boolean,
  motionSource: V3WorkbenchMotionSource = 'keyboard',
): PresenceResult {
  const [mounted, setMounted] = useState(open)
  const [phase, setPhase] = useState<V3WorkbenchPhase>(open ? 'opening' : 'closed')
  const [reducedMotion, setReducedMotion] = useState(false)
  const frameRef = useRef<HTMLDivElement>(null)
  const veilRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const generationRef = useRef(0)
  const frameAnimationRef = useRef<Animation | null>(null)
  const veilAnimationRef = useRef<Animation | null>(null)
  const bodyAnimationRef = useRef<Animation | null>(null)
  const carriedFrameRef = useRef<Pose | null>(null)
  const carriedVeilRef = useRef<Pose | null>(null)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!ready) return
    if (open && !mounted) {
      setMounted(true)
      return
    }
    if (!mounted) return

    const generation = ++generationRef.current
    let live = true
    const frame = frameRef.current
    const veil = veilRef.current
    const body = bodyRef.current
    if (!frame || !veil) return

    const previousFrame = cancelAtCurrentPose(frameAnimationRef.current, frame) ?? carriedFrameRef.current
    const previousVeil = cancelAtCurrentPose(veilAnimationRef.current, veil) ?? carriedVeilRef.current
    carriedFrameRef.current = null
    carriedVeilRef.current = null
    cancelAtCurrentPose(bodyAnimationRef.current, body)
    frameAnimationRef.current = null
    veilAnimationRef.current = null
    bodyAnimationRef.current = null

    const settle = () => {
      if (!live || generation !== generationRef.current) return
      frameAnimationRef.current?.cancel()
      veilAnimationRef.current?.cancel()
      bodyAnimationRef.current?.cancel()
      frameAnimationRef.current = null
      veilAnimationRef.current = null
      bodyAnimationRef.current = null
      carriedFrameRef.current = null
      carriedVeilRef.current = null
      clearPose(frame)
      clearPose(veil)
      clearPose(body)
      setPhase(open ? 'open' : 'closed')
      if (!open) setMounted(false)
    }

    if (reducedMotion || motionSource === 'keyboard' || typeof frame.animate !== 'function') {
      settle()
      return
    }

    setPhase(open ? 'opening' : 'closing')
    const frameFrom = previousFrame ?? (open ? ENTER_FRAME : REST_FRAME)
    const veilFrom = previousVeil ?? { transform: 'none', opacity: open ? '0' : '1' }
    const frameTo = open ? REST_FRAME : EXIT_FRAME
    frameAnimationRef.current = frame.animate([
      { transform: frameFrom.transform, opacity: frameFrom.opacity },
      { transform: frameTo.transform, opacity: frameTo.opacity },
    ], {
      duration: open ? 260 : 160,
      easing: open ? 'cubic-bezier(.32,.72,0,1)' : 'cubic-bezier(.22,1,.36,1)',
      fill: 'forwards',
    })
    veilAnimationRef.current = veil.animate([
      { transform: veilFrom.transform, opacity: veilFrom.opacity },
      { transform: 'none', opacity: open ? '1' : '0' },
    ], {
      duration: open ? 160 : 140,
      easing: 'cubic-bezier(.22,1,.36,1)',
      fill: 'forwards',
    })
    if (open && !previousFrame && body) {
      bodyAnimationRef.current = body.animate([
        { transform: ENTER_BODY.transform, opacity: ENTER_BODY.opacity },
        { transform: REST_BODY.transform, opacity: REST_BODY.opacity },
      ], {
        duration: 180,
        delay: 36,
        easing: 'cubic-bezier(.22,1,.36,1)',
        fill: 'both',
      })
    }
    void frameAnimationRef.current.finished.then(settle, () => undefined)

    return () => {
      live = false
      carriedFrameRef.current = cancelAtCurrentPose(frameAnimationRef.current, frame)
      carriedVeilRef.current = cancelAtCurrentPose(veilAnimationRef.current, veil)
      cancelAtCurrentPose(bodyAnimationRef.current, body)
      frameAnimationRef.current = null
      veilAnimationRef.current = null
      bodyAnimationRef.current = null
    }
  }, [open, ready, mounted, motionSource, reducedMotion])

  return { mounted, phase, frameRef, veilRef, bodyRef }
}
