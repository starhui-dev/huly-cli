import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

export interface HulyCliConfig {
  readonly env: NodeJS.ProcessEnv
  readonly configPath?: string
}

const ENV_KEYS = new Set([
  "HULY_URL",
  "HULY_EMAIL",
  "HULY_PASSWORD",
  "HULY_TOKEN",
  "HULY_WORKSPACE",
  "HULY_CONNECTION_TIMEOUT"
])

export const parseEnvFile = (content: string): Record<string, string> => {
  const parsed: Record<string, string> = {}

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === "" || line.startsWith("#")) continue

    const normalized = line.startsWith("export ") ? line.slice("export ".length).trim() : line
    const separatorIndex = normalized.indexOf("=")
    if (separatorIndex <= 0) continue

    const key = normalized.slice(0, separatorIndex).trim()
    if (!ENV_KEYS.has(key)) continue

    parsed[key] = parseEnvValue(normalized.slice(separatorIndex + 1).trim())
  }

  return parsed
}

const parseEnvValue = (value: string): string => {
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
      return value.slice(1, -1)
    }
  }

  const hashIndex = value.indexOf(" #")
  return hashIndex === -1 ? value : value.slice(0, hashIndex).trimEnd()
}

interface LoadConfigOptions {
  readonly config?: string
}

export const loadConfig = (options: LoadConfigOptions): HulyCliConfig => {
  const configPath = options.config === undefined ? undefined : resolve(options.config)
  const envFromFile = configPath === undefined
    ? {}
    : existsSync(configPath)
      ? parseEnvFile(readFileSync(configPath, "utf8"))
      : fail(`Config file not found: ${configPath}`)

  return {
    env: {
      ...process.env,
      ...envFromFile
    },
    ...(configPath === undefined ? {} : { configPath })
  }
}

export const validateConfig = (config: HulyCliConfig): void => {
  const env = config.env
  const missing: string[] = []

  if (!hasText(env.HULY_URL)) missing.push("HULY_URL")
  if (!hasText(env.HULY_WORKSPACE)) missing.push("HULY_WORKSPACE")

  const hasToken = hasText(env.HULY_TOKEN)
  const hasPasswordAuth = hasText(env.HULY_EMAIL) && hasText(env.HULY_PASSWORD)
  if (!hasToken && !hasPasswordAuth) {
    missing.push("HULY_TOKEN or HULY_EMAIL+HULY_PASSWORD")
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing Huly configuration: ${missing.join(", ")}. `
        + "Set environment variables or pass --config .env."
    )
  }
}

const hasText = (value: string | undefined): boolean => value !== undefined && value.trim() !== ""

const fail = (message: string): never => {
  throw new Error(message)
}
