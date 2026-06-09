import { describe, expect, it } from "vitest"

import { parseEnvFile, validateConfig } from "../src/config.js"

describe("parseEnvFile", () => {
  it("parses supported Huly env vars", () => {
    expect(parseEnvFile(`
      # ignored
      export HULY_URL="https://huly.app"
      HULY_WORKSPACE='demo'
      HULY_TOKEN=secret # comment
      OTHER=value
    `)).toEqual({
      HULY_URL: "https://huly.app",
      HULY_WORKSPACE: "demo",
      HULY_TOKEN: "secret"
    })
  })
})

describe("validateConfig", () => {
  it("accepts token auth", () => {
    expect(() =>
      validateConfig({
        env: {
          HULY_URL: "https://huly.app",
          HULY_WORKSPACE: "demo",
          HULY_TOKEN: "token"
        }
      })
    ).not.toThrow()
  })

  it("requires Huly URL, workspace, and auth", () => {
    expect(() => validateConfig({ env: {} })).toThrow(
      "Missing Huly configuration: HULY_URL, HULY_WORKSPACE, HULY_TOKEN or HULY_EMAIL+HULY_PASSWORD"
    )
  })
})
