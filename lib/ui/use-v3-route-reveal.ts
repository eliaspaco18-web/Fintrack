'use client'

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

type RouteSource = 'pointer' | 'keyboard'
interface RouteIntent { pathname: string; source: RouteSource }

/** Route motion is shell-owned; modules may opt into summary/work groups as they migrate. */
export function useV3RouteReveal(
  pathname: string,
  contentRef: RefObject<HTMLElement>,
  mainRef: RefObject<HTMLElement>,
): string {
  const [announcement, setAnnouncement] = useState('')
  const previousPathname = useRef<string | null>(null)
  const intent = useRef<RouteIntent | null>(null)
  const historyNavigation = useRef(false)
  const animations = useRef<Set<Animation>>(new Set())
  const focusObserver = useRef<MutationObserver | null>(null)
  const focusFrame = useRef<number | null>(null)

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const target = event.target
      const link = target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null
      if (!link) return
      const url = new URL(link.href, window.location.href)
      if (url.origin === window.location.origin && url.pathname !== window.location.pathname) {
        intent.current = { pathname: url.pathname, source: 'pointer' }
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return
      const target = event.target
      const link = target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null
      if (!link) return
      const url = new URL(link.href, window.location.href)
      if (url.origin === window.location.origin && url.pathname !== window.location.pathname) {
        intent.current = { pathname: url.pathname, source: 'keyboard' }
      }
    }
    const onExplicitIntent = (event: Event) => {
      const detail = (event as CustomEvent<RouteIntent>).detail
      if (detail?.pathname && (detail.source === 'pointer' || detail.source === 'keyboard')) {
        intent.current = detail
      }
    }
    const onPopState = () => {
      historyNavigation.current = true
      intent.current = null
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('ft-v3-route-intent', onExplicitIntent)
    window.addEventListener('popstate', onPopState)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('ft-v3-route-intent', onExplicitIntent)
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const settle = () => {
      if (!preference.matches) return
      for (const animation of animations.current) animation.cancel()
      animations.current.clear()
    }
    preference.addEventListener('change', settle)
    return () => preference.removeEventListener('change', settle)
  }, [])

  useLayoutEffect(() => {
    const previous = previousPathname.current
    previousPathname.current = pathname
    if (!previous || previous === pathname) return

    for (const animation of animations.current) animation.cancel()
    animations.current.clear()
    focusObserver.current?.disconnect()
    focusObserver.current = null
    if (focusFrame.current !== null) window.cancelAnimationFrame(focusFrame.current)
    focusFrame.current = null

    const wasHistory = historyNavigation.current
    historyNavigation.current = false
    const currentIntent = intent.current
    intent.current = null
    if (!wasHistory && mainRef.current) mainRef.current.scrollTop = 0

    const root = contentRef.current
    const heading = root?.querySelector<HTMLElement>('[data-ft-route-heading]') ??
      document.querySelector<HTMLElement>('.fin-topbar h1')
    if (heading) {
      const focusWhenAvailable = () => {
        if (!heading.isConnected || heading.closest('[inert]')) return false
        heading.focus({ preventScroll: true })
        setAnnouncement(heading.textContent?.trim() ?? '')
        return true
      }
      if (!focusWhenAvailable()) {
        const observer = new MutationObserver(() => {
          if (heading.closest('[inert]') || focusFrame.current !== null) return
          focusFrame.current = window.requestAnimationFrame(() => {
            focusFrame.current = null
            if (focusWhenAvailable()) {
              observer.disconnect()
              if (focusObserver.current === observer) focusObserver.current = null
            }
          })
        })
        observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['inert'] })
        focusObserver.current = observer
      }
    }

    if (wasHistory || currentIntent?.pathname !== pathname || currentIntent.source !== 'pointer' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches || !root) return

    const animate = (element: HTMLElement, y: number, duration: number, delay: number) => {
      const animation = element.animate(
        [{ opacity: .35, transform: `translateY(${y}px)` }, { opacity: 1, transform: 'translateY(0)' }],
        { duration, delay, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' },
      )
      animations.current.add(animation)
      animation.onfinish = () => {
        animation.cancel()
        animations.current.delete(animation)
      }
    }

    if (heading) animate(heading, 3, 160, 0)
    const summary = root.querySelector<HTMLElement>('[data-ft-route-group="summary"]')
    const work = Array.from(root.querySelectorAll<HTMLElement>('[data-ft-route-group="work"]'))
    if (summary) animate(summary, 5, 180, 24)
    if (work.length > 0) work.forEach(element => animate(element, 6, 180, 48))
    else if (!summary) animate(root, 6, 180, 48)
  }, [contentRef, mainRef, pathname])

  useEffect(() => () => {
    for (const animation of animations.current) animation.cancel()
    animations.current.clear()
    focusObserver.current?.disconnect()
    if (focusFrame.current !== null) window.cancelAnimationFrame(focusFrame.current)
  }, [])

  return announcement
}
