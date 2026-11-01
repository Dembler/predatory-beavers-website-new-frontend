import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

type Category = 'men' | 'women'
type TeamFilter = Category | 'all'
const storageKey = 'pb-team-category'

function category(value: unknown): Category | null {
  return value === 'men' || value === 'women' ? value : null
}
function readPreference() {
  try {
    return category(localStorage.getItem(storageKey))
  } catch {
    return null
  }
}

const selection = ref<Category | null>(readPreference())
export const preferredTeam = computed(() => selection.value ?? 'men')
export const preferredTeamPath = computed(() => `/teams/${preferredTeam.value}`)

export function rememberTeam(value: unknown) {
  const next = category(value)
  if (!next) return
  selection.value = next
  try {
    localStorage.setItem(storageKey, next)
  } catch {
    // Navigation still works when browser storage is unavailable.
  }
}

export function useTeamFilter<T extends TeamFilter>(fallback: T) {
  const route = useRoute()
  const router = useRouter()
  const path = route.path
  const parse = (value: unknown) =>
    category(value) ?? (fallback === 'all' && value === 'all' ? 'all' : null)
  const initial = parse(route.query.team) ?? selection.value ?? fallback
  const team = ref<TeamFilter>(initial)

  watch(team, rememberTeam, { immediate: true })
  watch(
    () => route.query.team,
    (value) => {
      if (route.path === path) team.value = parse(value) ?? initial
    },
  )
  watch(team, (value) => {
    if (route.path !== path) return
    if (parse(route.query.team) === value || (!route.query.team && value === initial)) return
    void router.replace({ query: { ...route.query, team: value } })
  })
  return team
}
