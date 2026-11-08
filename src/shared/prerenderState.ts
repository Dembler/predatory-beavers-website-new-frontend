import { nextTick } from 'vue'

/** Inactive for visitors. The anonymous build browser enables this before Vue starts. */
export function beginPrerenderLoad() {
  const root = document.documentElement
  if (root.dataset.prerender !== 'active') return () => {}
  root.dataset.prerenderPending = String(Number(root.dataset.prerenderPending || 0) + 1)
  root.dataset.prerenderStarted = String(Number(root.dataset.prerenderStarted || 0) + 1)
  return async (failed = false) => {
    // Vue must commit the resolved data before the build can serialize the document.
    await nextTick()
    if (failed)
      root.dataset.prerenderFailures = String(Number(root.dataset.prerenderFailures || 0) + 1)
    root.dataset.prerenderPending = String(Number(root.dataset.prerenderPending || 0) - 1)
    document.dispatchEvent(new Event('prerender:progress'))
  }
}
