const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')

export async function apiRequest<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { credentials: 'include' })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json() as Promise<T>
}

export function mediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined
  return path.startsWith('http') ? path : `${apiBase}${path}`
}
