import type { components } from './api/schema'

export type CalendarPage = components['schemas']['CalendarPage']
export type CalendarEntry = components['schemas']['CalendarEntry']
export type CalendarSection = CalendarEntry['section']
