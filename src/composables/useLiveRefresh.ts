import { onBeforeUnmount, onMounted } from 'vue'

// Poll only while the page is visible, and immediately catch up after returning
// to a tab or reconnecting. A slow request never starts a parallel poll.
export function useLiveRefresh(refresh: () => Promise<unknown>, intervalMs = 60_000) {
  let timer: number | undefined
  let running = false
  let disposed = false

  async function run() {
    if (disposed || running || document.visibilityState !== 'visible' || !navigator.onLine) return
    running = true
    try {
      await refresh()
    } finally {
      running = false
    }
  }
  const resume = () => void run()

  onMounted(() => {
    timer = window.setInterval(resume, intervalMs)
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('focus', resume)
    window.addEventListener('online', resume)
  })
  onBeforeUnmount(() => {
    disposed = true
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', resume)
    window.removeEventListener('focus', resume)
    window.removeEventListener('online', resume)
  })
}
