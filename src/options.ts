export interface CommonOptions {
  readonly config?: string
  readonly json?: boolean
}

export const collectKeyValue = (
  value: string,
  previous: Record<string, string | boolean | number | null>
): Record<string, string | boolean | number | null> => {
  const separatorIndex = value.indexOf("=")
  if (separatorIndex <= 0) {
    throw new Error(`Expected key=value, got "${value}"`)
  }

  const key = value.slice(0, separatorIndex)
  const raw = value.slice(separatorIndex + 1)
  return {
    ...previous,
    [key]: coerceScalar(raw)
  }
}

const coerceScalar = (value: string): string | boolean | number | null => {
  if (value === "true") return true
  if (value === "false") return false
  if (value === "null") return null
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value)
  return value
}
