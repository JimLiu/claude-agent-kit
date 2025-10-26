import { describe, expect, it } from "vitest";
import { generateId } from "../../src/lib/id";

describe("generateId", () => {
  it("returns the nanoid output", () => {
    const id = generateId();

    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });
});
