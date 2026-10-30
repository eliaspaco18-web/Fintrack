'use client'

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

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

function poseOf(element: HTMLElement): Pose {
  const style = getComputedStyle(element)
  return { transform: style.transform, opacity: style.opacity }
}

function applyPose(element: HTMLElement | null, pose: Pose) {
  if (!element) return
  element.style.transform = pose.transform
  element.style.opacity = pose.opacity
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
  onExitComplete?: () => void,
): PresenceResult {
  // Kept in the public signature for callers; every dismissal now uses one
  // stable exit motion, so this value must not restart the presence effect.
  void motionSource
  const [mounted, setMounted] = useState(open)
  const [phase, setPhase] = useState<V3WorkbenchPhase>(open ? 'opening' : 'closed')
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const frameRef = useRef<HTMLDivElement>(null)
  const veilRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const generationRef = useRef(0)
  const frameAnimationRef = useRef<Animation | null>(null)
  const veilAnimationRef = useRef<Animation | null>(null)
  const carriedFrameRef = useRef<Pose | null>(null)
  const carriedVeilRef = useRef<Pose | null>(null)
  const exitCompletionPendingRef = useRef(false)
  const onExitCompleteRef = useRef(onExitComplete)

  onExitCompleteRef.current = onExitComplete

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  // Notify the owner only after React has committed mounted=false and removed
  // the portal. This prevents parent state (for example, the create selector)
  // from changing while the exiting panel still exists in the DOM.
  useLayoutEffect(() => {
    if (open) {
      // A quick reopen supersedes the pending exit. Do not reset the parent's
      // content after the workbench has been reopened.
      exitCompletionPendingRef.current = false
      return
    }
    if (mounted || !exitCompletionPendingRef.current) return
    exitCompletionPendingRef.current = false
    onExitCompleteRef.current?.()
  }, [mounted, open])

  useLayoutEffect(() => {
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
    if (!frame || !veil) return

    const previousFrame = cancelAtCurrentPose(frameAnimationRef.current, frame) ?? carriedFrameRef.current
    const previousVeil = cancelAtCurrentPose(veilAnimationRef.current, veil) ?? carriedVeilRef.current
    carriedFrameRef.current = null
    carriedVeilRef.current = null
    frameAnimationRef.current = null
    veilAnimationRef.current = null

    const settle = () => {
      if (!live || generation !== generationRef.current) return
      // WAAPI's fill-forwards effect currently supplies the final pose. Write
      // that pose inline *before* cancelling the animations, so removing the
      // fill effect cannot restore the panel/veil to their visible CSS pose
      // during the React commit that removes the portal.
      applyPose(frame, open ? REST_FRAME : EXIT_FRAME)
      applyPose(veil, { transform: 'none', opacity: open ? '1' : '0' })
      frameAnimationRef.current?.cancel()
      veilAnimationRef.current?.cancel()
      frameAnimationRef.current = null
      veilAnimationRef.current = null
      carriedFrameRef.current = null
      carriedVeilRef.current = null
      setPhase(open ? 'open' : 'closed')
      if (!open) {
        exitCompletionPendingRef.current = true
        setMounted(false)
      }
    }

    // Every dismissal path uses the same exit treatment; reduced motion is the
    // only condition that skips the transition.
    if (reducedMotion || typeof frame.animate !== 'function') {
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
    void frameAnimationRef.current.finished.then(settle, () => undefined)

    return () => {
      live = false
      carriedFrameRef.current = cancelAtCurrentPose(frameAnimationRef.current, frame)
      carriedVeilRef.current = cancelAtCurrentPose(veilAnimationRef.current, veil)
      frameAnimationRef.current = null
      veilAnimationRef.current = null
    }
  // motionSource is intentionally not a lifecycle dependency: all dismissals
  // use the same exit motion, so changing its bookkeeping must not restart WAAPI.
  }, [open, ready, mounted, reducedMotion])

  return { mounted, phase, frameRef, veilRef, bodyRef }
}
