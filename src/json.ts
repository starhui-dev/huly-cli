import { readFileSync } from "node:fs"

export const parseJsonObject = (value: string, label: string): Record<string, unknown> => {
  const parsed = parseJson(value, label)
  if (!isRecord(parsed)) {
    throw new Error(`${label} must be a JSON object`)
  }
  return parsed
}

export const parseJson = (value: string, label: string): unknown => {
  try {
    return JSON.parse(value)
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${String(error)}`)
  }
}

export const readJsonObjectFile = (path: string): Record<string, unknown> =>
  parseJsonObject(readFileSync(path, "utf8"), path)

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
