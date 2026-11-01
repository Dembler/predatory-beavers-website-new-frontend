export type FormValue = string | number | boolean | null
export type AdminRecord = { id: string; [key: string]: unknown }
export interface AdminField {
  key: string
  label: string
  type?:
    | 'text'
    | 'textarea'
    | 'number'
    | 'date'
    | 'datetime-local'
    | 'select'
    | 'checkbox'
    | 'image'
  required?: boolean
  maxLength?: number
  min?: number
  max?: number
  hint?: string
  options?: { value: string; label: string }[]
}
export interface AdminConfig {
  title: string
  singular: string
  endpoint: string
  query?: string
  description: string
  fields: AdminField[]
  defaults: Record<string, FormValue>
  columns: { label: string; value: (row: AdminRecord) => string }[]
  prepare?: (form: Record<string, FormValue>) => Record<string, unknown>
  publicPath?: string | ((row: AdminRecord) => string)
  publicLabel?: string
}

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Произошла ошибка. Повторите попытку.'
