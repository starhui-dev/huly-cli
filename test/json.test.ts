import { describe, expect, it } from "vitest"

import { parseJsonObject } from "../src/json.js"

describe("parseJsonObject", () => {
  it("parses objects", () => {
    expect(parseJsonObject('{"project":"HULY"}', "--data")).toEqual({ project: "HULY" })
  })

  it("rejects arrays", () => {
    expect(() => parseJsonObject("[]", "--data")).toThrow("--data must be a JSON object")
  })
})
