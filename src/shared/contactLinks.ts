export function safeContactUrl(value: string | null | undefined): string | undefined {
  if (!value || /[\s\\\u0000-\u001f\u007f]/u.test(value)) return undefined
  try {
    if (/[\u0000-\u001f\u007f]/u.test(decodeURIComponent(value))) return undefined
    const url = new URL(value)
    if (url.username || url.password) return undefined
    if (['http:', 'https:'].includes(url.protocol)) return url.href
    if (url.protocol === 'tel:' && /^\+?[0-9][0-9().-]{2,30}$/u.test(url.pathname)) return value
    if (
      url.protocol === 'mailto:' &&
      /^[^@\s,;<>?"]+@[^@\s,;<>?"]+\.[^@\s,;<>?"]+$/u.test(url.pathname) &&
      !url.search &&
      !url.hash
    )
      return value
  } catch {
    /* Invalid links are displayed as plain text. */
  }
  return undefined
}

export const isWebContact = (value: string | null | undefined) => /^https?:/iu.test(value || '')
