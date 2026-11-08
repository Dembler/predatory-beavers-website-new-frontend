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
  min?: number | string
  max?: number | string
  step?: number | 'any'
  hint?: string
  options?: { value: string; label: string }[]
  onChange?: (form: Record<string, FormValue>, previous: FormValue) => void
}
export interface AdminFilter {
  key: string
  label: string
  options: { value: string; label: string }[]
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
  allowCreate?: boolean
  allowDelete?: boolean
  filters?: AdminFilter[]
  refreshReferences?: () => Promise<void>
  deleteWarning?: (row: AdminRecord) => string | Promise<string>
  deleteImpact?: (row: AdminRecord) => string | Promise<string>
  onChange?: (
    key: string,
    value: FormValue,
    form: Record<string, FormValue>,
    previous: FormValue,
  ) => void
}

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Произошла ошибка. Повторите попытку.'
