import { onBeforeUnmount, onMounted, ref, watch, type Ref, type WatchSource } from 'vue'

export function useLoad<T>(loader: () => Promise<T>, sources: WatchSource[] = []) {
  const data = ref<T | null>(null) as Ref<T | null>
  const pending = ref(true)
  const error = ref(false)
  let generation = 0

  async function load() {
    const current = ++generation
    pending.value = true
    error.value = false
    try {
      const result = await loader()
      if (current === generation) data.value = result
    } catch {
      if (current === generation) error.value = true
    } finally {
      if (current === generation) pending.value = false
    }
  }

  onMounted(load)
  if (sources.length) watch(sources, load)
  onBeforeUnmount(() => {
    generation++
  })
  return { data, pending, error, load }
}
