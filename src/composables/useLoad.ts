import { onMounted, ref, type Ref } from 'vue'

export function useLoad<T>(loader: () => Promise<T>) {
  const data = ref<T | null>(null) as Ref<T | null>
  const pending = ref(true)
  const error = ref(false)

  async function load() {
    pending.value = true
    error.value = false
    try {
      data.value = await loader()
    } catch {
      error.value = true
    } finally {
      pending.value = false
    }
  }

  onMounted(load)
  return { data, pending, error, load }
}
