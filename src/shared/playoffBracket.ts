import type { StandingsGame } from './types'

export interface PlayoffBracketRound {
  id: string
  title: string
  column: number
  round: number | null
}

export interface PlayoffBracketNode {
  id: string
  games: StandingsGame[]
  roundId: string
  column: number
  /** Centre of the card, measured in rows. The first row has centre 0.5. */
  row: number
  /** Local pair position in this tree, including any unpublished pairs. */
  slot: number
}

export interface PlayoffBracketLink {
  id: string
  from: string
  to: string
}

export interface PlayoffBracketLayout {
  id: string
  title: string
  kind: 'main' | 'placement'
  tree: number | null
  rounds: PlayoffBracketRound[]
  nodes: PlayoffBracketNode[]
  links: PlayoffBracketLink[]
  rowCount: number
}

interface Pair {
  games: StandingsGame[]
  sort: number
}

interface Round {
  key: string
  value: number | null
  title: string
  pairs: Map<string, Pair>
}

function teamKey(id: string | null | undefined, name: string): string {
  return id ? `id:${id}` : `name:${name.trim().toLocaleLowerCase('ru')}`
}

function pairKey(game: StandingsGame): string {
  return [
    teamKey(game.home_team_id, game.home_team_name),
    teamKey(game.away_team_id, game.away_team_name),
  ]
    .sort()
    .join('|')
}

function roundValue(game: StandingsGame): number | null {
  if (game.round && Number.isInteger(game.round) && game.round > 0) return game.round
  const fraction = game.round_name.match(/1\s*\/\s*(\d+)/)
  if (fraction) return Number(fraction[1]) || null
  if (/четвертьфинал/i.test(game.round_name)) return 4
  if (/полуфинал/i.test(game.round_name)) return 2
  if (/финал|\d+\s*(?:-?е\s*)?мест/i.test(game.round_name)) return 1
  return null
}

function treeValue(game: StandingsGame): number | null {
  if (game.tree && Number.isInteger(game.tree) && game.tree > 0) return game.tree
  const place = game.round_name.match(/(\d+)\s*(?:-?е\s*)?мест/i)
  return place ? (Number(place[1]) + 1) / 2 : null
}

function roundTitle(value: number | null, name: string, placement: boolean): string {
  if (value === 1) return placement ? name : 'Финал'
  if (value === 2) return 'Полуфиналы'
  if (value === 4) return 'Четвертьфиналы'
  return value ? `1/${value} финала` : name || 'Плей-офф'
}

function compareGames(a: StandingsGame, b: StandingsGame): number {
  return (
    (a.starts_at || '9999').localeCompare(b.starts_at || '9999') ||
    a.external_id.localeCompare(b.external_id, undefined, { numeric: true })
  )
}

function hasSameTeam(a: StandingsGame, sideA: 'home' | 'away', b: StandingsGame): boolean {
  const id = a[`${sideA}_team_id`]
  const name = a[`${sideA}_team_name`].trim().toLocaleLowerCase('ru')
  return (['home', 'away'] as const).some((sideB) => {
    const otherId = b[`${sideB}_team_id`]
    if (id && otherId) return id === otherId
    return name === b[`${sideB}_team_name`].trim().toLocaleLowerCase('ru')
  })
}

function canProgress(from: PlayoffBracketNode, to: PlayoffBracketNode): boolean {
  const first = from.games[0]!
  const next = to.games[0]!
  const home = hasSameTeam(first, 'home', next)
  const away = hasSameTeam(first, 'away', next)
  if (home === away) return false
  // One published game's result identifies the advancing team. A series may
  // use aggregate scores or wins, so do not infer its rules from its games.
  if (
    from.games.length === 1 &&
    first.status === 'finished' &&
    first.home_score !== null &&
    first.away_score !== null &&
    first.home_score !== first.away_score
  ) {
    return first.home_score > first.away_score ? home : away
  }
  return true
}

/**
 * Keep ASB's pair slots rather than compressing missing games into the first
 * available position. Separate placement trees never feed the championship
 * final. The input games and their results are not mutated or aggregated.
 */
export function buildPlayoffBrackets(games: StandingsGame[]): PlayoffBracketLayout[] {
  const trees = new Map<number | null, StandingsGame[]>()
  for (const game of games) {
    const tree = treeValue(game)
    const list = trees.get(tree) || []
    list.push(game)
    trees.set(tree, list)
  }

  return [...trees.entries()]
    .sort(([a], [b]) => (a || 1) - (b || 1))
    .map(([tree, treeGames]) => {
      const placement = tree !== null && tree > 1
      const id = `tree-${tree ?? 'main'}`
      const roundMap = new Map<string, Round>()

      for (const game of treeGames) {
        const value = roundValue(game)
        const key = value ? `round-${value}` : `round-${game.round_name.trim()}`
        let round = roundMap.get(key)
        if (!round) {
          round = {
            key,
            value,
            title: roundTitle(value, game.round_name, placement),
            pairs: new Map(),
          }
          roundMap.set(key, round)
        }
        // Reversed home/away legs belong to the same pair, but every leg is
        // retained with its own date, score, status and official source.
        const keyPair = pairKey(game)
        const pair = round.pairs.get(keyPair)
        if (pair) {
          pair.games.push(game)
          if (game.sort_order > 0) pair.sort = Math.min(pair.sort || Infinity, game.sort_order)
        } else round.pairs.set(keyPair, { games: [game], sort: game.sort_order })
      }

      const rounds = [...roundMap.values()].sort((a, b) => {
        if (a.value && b.value) return b.value - a.value
        if (a.value !== b.value) return a.value ? -1 : 1
        const aDate = [...a.pairs.values()].flatMap((p) => p.games).sort(compareGames)[0]!
        const bDate = [...b.pairs.values()].flatMap((p) => p.games).sort(compareGames)[0]!
        return compareGames(aDate, bDate)
      })
      const rowCount = Math.max(1, ...rounds.map((r) => Math.max(r.value || 1, r.pairs.size)))
      const layout: PlayoffBracketLayout = {
        id,
        title: placement ? `За ${tree * 2 - 1}-е место` : 'Основная сетка',
        kind: placement ? 'placement' : 'main',
        tree,
        rounds: [],
        nodes: [],
        links: [],
        rowCount,
      }
      const officialSlots = new Set<string>()

      rounds.forEach((round, column) => {
        const roundId = `${id}-${round.key}`
        layout.rounds.push({ id: roundId, title: round.title, column, round: round.value })
        const pairs = [...round.pairs.values()].sort(
          (a, b) =>
            (a.sort || Infinity) - (b.sort || Infinity) || compareGames(a.games[0]!, b.games[0]!),
        )
        const slotCount = Math.max(round.value || pairs.length, pairs.length)
        const usedSlots = new Set<number>()

        pairs.forEach((pair) => {
          // ASB numbers pairs across all trees. For example a fifth-place
          // semifinal has Sort=3/4 and Round=2, hence local slot=1/2.
          const officialSlot = pair.sort > 0 ? ((pair.sort - 1) % slotCount) + 1 : null
          let slot = officialSlot
          if (!slot || usedSlots.has(slot)) {
            slot = 1
            while (usedSlots.has(slot)) slot++
          }
          usedSlots.add(slot)
          const sortedGames = [...pair.games].sort(compareGames)
          const nodeId = `${roundId}-${sortedGames[0]!.external_id}`
          if (slot === officialSlot) officialSlots.add(nodeId)
          layout.nodes.push({
            id: nodeId,
            games: sortedGames,
            roundId,
            column,
            row: (slot - 0.5) * (rowCount / slotCount),
            slot,
          })
        })
      })

      for (const from of layout.nodes) {
        const currentRound = layout.rounds[from.column]!
        const nextRound = layout.rounds[from.column + 1]
        // Missing complete rounds do not justify a direct progression line.
        if (!currentRound.round || !nextRound?.round || currentRound.round !== nextRound.round * 2)
          continue
        const destinations = layout.nodes.filter(
          (to) =>
            to.column === from.column + 1 &&
            (!officialSlots.has(from.id) ||
              !officialSlots.has(to.id) ||
              Math.ceil(from.slot / 2) === to.slot) &&
            canProgress(from, to),
        )
        if (destinations.length === 1) {
          const to = destinations[0]!
          layout.links.push({ id: `${from.id}->${to.id}`, from: from.id, to: to.id })
        }
      }
      return layout
    })
}
