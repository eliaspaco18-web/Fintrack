/** Body-sibling ownership for an opt-in V3 modal. No route or data ownership lives here. */
const owners: HTMLElement[] = []
const priorInert = new Map<HTMLElement, boolean>()
let priorOverflow: string | null = null
let observer: MutationObserver | null = null

function syncOwnership() {
  const current = owners.filter(owner => owner.isConnected).at(-1)
  if (!current) return
  for (const child of Array.from(document.body.children)) {
    if (!(child instanceof HTMLElement)) continue
    if (!priorInert.has(child)) priorInert.set(child, child.inert)
    child.inert = child !== current
  }
}

export function acquireV3ModalBackground(owner: HTMLElement): () => void {
  if (owners.includes(owner)) return () => undefined
  if (owners.length === 0) {
    priorOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    observer = new MutationObserver(syncOwnership)
    observer.observe(document.body, { childList: true })
  }
  owners.push(owner)
  syncOwnership()

  let released = false
  return () => {
    if (released) return
    released = true
    const index = owners.indexOf(owner)
    if (index >= 0) owners.splice(index, 1)
    if (owners.length > 0) {
      syncOwnership()
      return
    }
    observer?.disconnect()
    observer = null
    for (const [element, wasInert] of priorInert) element.inert = wasInert
    priorInert.clear()
    if (document.body.style.overflow === 'hidden') {
      document.body.style.overflow = priorOverflow ?? ''
    }
    priorOverflow = null
  }
}
