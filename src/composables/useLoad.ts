import { onBeforeUnmount, onMounted, ref, watch, type Ref, type WatchSource } from 'vue'
import { beginPrerenderLoad } from '@/shared/prerenderState'

export function useLoad<T>(loader: () => Promise<T>, sources: WatchSource[] = []) {
  const data = ref<T | null>(null) as Ref<T | null>
  const pending = ref(true)
  const error = ref(false)
  const refreshing = ref(false)
  const refreshError = ref(false)
  let generation = 0
  let inFlight: Promise<void> | null = null

  async function run(background: boolean) {
    const completePrerenderLoad = beginPrerenderLoad()
    let failed = false
    const current = ++generation
    if (!background) {
      pending.value = true
      error.value = false
    }
    refreshing.value = background
    try {
      const result = await Promise.resolve().then(loader)
      if (current === generation) {
        data.value = result
        error.value = false
        refreshError.value = false
      }
    } catch {
      failed = true
      if (current === generation) {
        if (background) refreshError.value = true
        else error.value = true
      }
    } finally {
      if (current === generation) {
        pending.value = false
        refreshing.value = false
        inFlight = null
      }
      await completePrerenderLoad(failed)
    }
  }

  function load() {
    inFlight = run(false)
    return inFlight
  }
  function refresh() {
    if (inFlight) return inFlight
    inFlight = run(data.value !== null)
    return inFlight
  }

  onMounted(load)
  if (sources.length) watch(sources, load)
  onBeforeUnmount(() => {
    generation++
  })
  return { data, pending, error, load, refresh, refreshing, refreshError }
}
