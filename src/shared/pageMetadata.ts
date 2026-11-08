export function setMetadata(attribute: 'name' | 'property', key: string, value: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attribute, key)
    document.head.append(tag)
  }
  tag.content = value
}

export function setPageIdentity(title: string, description: string) {
  document.title = title
  setMetadata('name', 'description', description)
  setMetadata('name', 'twitter:title', title)
  setMetadata('name', 'twitter:description', description)
  setMetadata('property', 'og:title', title)
  setMetadata('property', 'og:description', description)
}

/** A prerendered page carries the deployment's canonical origin across SPA navigation. */
export function publicPageUrl(path: string): string {
  const configured =
    import.meta.env.VITE_SITE_URL ||
    document.head.querySelector<HTMLMetaElement>('meta[name="site-origin"]')?.content
  let origin = window.location.origin
  if (configured) {
    try {
      const candidate = new URL(configured)
      if (['https:', 'http:'].includes(candidate.protocol)) origin = candidate.origin
    } catch {
      // A malformed optional deployment value must not break navigation.
    }
  }
  return new URL(path, origin).href
}
