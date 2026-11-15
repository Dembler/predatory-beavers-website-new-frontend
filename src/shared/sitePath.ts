/** Assets shipped with the frontend follow Vite's deployment directory. */
export function sitePath(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
}
