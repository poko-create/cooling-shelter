import { describe, expect, it } from "vitest";
import { isKotoTreeRow } from "../src/services/openData";

describe("open data loading", () => {
  it("keeps only Koto ward rows for tree scoring", () => {
    expect(isKotoTreeRow({ "行政区": "江東区" })).toBe(true);
    expect(isKotoTreeRow({ "行政区": "中央区" })).toBe(false);
    expect(isKotoTreeRow({})).toBe(true);
  });
});
