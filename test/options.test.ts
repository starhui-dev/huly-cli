import { describe, expect, it } from "vitest"

import { collectKeyValue } from "../src/options.js"

describe("collectKeyValue", () => {
  it("collects scalar fields", () => {
    let fields: Record<string, string | boolean | number | null> = {}
    for (const value of ["limit=10", "archived=true", "description=null", "project=HULY"]) {
      fields = collectKeyValue(value, fields)
    }

    expect(fields).toEqual({
      limit: 10,
      archived: true,
      description: null,
      project: "HULY"
    })
  })

  it("rejects values without a key", () => {
    expect(() => collectKeyValue("missing", {})).toThrow('Expected key=value, got "missing"')
  })
})
