export type OutputFormat = "json" | "pretty"

interface PrintOptions {
  readonly format: OutputFormat
}

export const printResult = (value: unknown, options: PrintOptions): void => {
  if (options.format === "json") {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
    return
  }

  process.stdout.write(`${formatPretty(value)}\n`)
}

const formatPretty = (value: unknown): string => {
  if (Array.isArray(value)) return value.map(formatPretty).join("\n")
  if (isRecord(value)) {
    if (Array.isArray(value.projects)) return formatTable(value.projects)
    if (Array.isArray(value.issues)) return formatTable(value.issues)
    if (Array.isArray(value.statuses)) return formatTable(value.statuses)
    if (Array.isArray(value.items)) return formatTable(value.items)
    return formatObject(value)
  }
  return String(value)
}

const formatObject = (record: Record<string, unknown>): string => {
  const lines: string[] = []
  for (const [key, value] of Object.entries(record)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`)
      lines.push(value.map((item) => `  ${formatInline(item)}`).join("\n"))
    } else if (isRecord(value)) {
      lines.push(`${key}: ${JSON.stringify(value, null, 2)}`)
    } else {
      lines.push(`${key}: ${formatInline(value)}`)
    }
  }
  return lines.join("\n")
}

const formatTable = (rows: readonly unknown[]): string => {
  if (rows.length === 0) return "(no results)"
  if (!rows.every(isRecord)) return rows.map(formatInline).join("\n")

  const records = rows as ReadonlyArray<Record<string, unknown>>
  const columns = selectColumns(records)
  const widths = columns.map((column) =>
    Math.max(column.length, ...records.map((row) => formatInline(row[column]).length))
  )

  const header = columns.map((column, index) => column.padEnd(widths[index] ?? column.length)).join("  ")
  const divider = widths.map((width) => "-".repeat(width)).join("  ")
  const body = records.map((row) =>
    columns.map((column, index) => formatInline(row[column]).padEnd(widths[index] ?? column.length)).join("  ")
  )

  return [header, divider, ...body].join("\n")
}

const selectColumns = (rows: ReadonlyArray<Record<string, unknown>>): string[] => {
  const preferred = [
    "identifier",
    "project",
    "title",
    "name",
    "status",
    "category",
    "priority",
    "assignee",
    "archived",
    "modifiedOn",
    "id",
    "class",
    "score"
  ]
  const available = new Set(rows.flatMap((row) => Object.keys(row)))
  const selected = preferred.filter((column) => available.has(column))
  return selected.length > 0 ? selected : Object.keys(rows[0] ?? {})
}

const formatInline = (value: unknown): string => {
  if (value === undefined || value === null) return ""
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(value)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
