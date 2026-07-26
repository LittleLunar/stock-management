import { describe, expect, it } from "vitest";

describe("application package", () => {
  it("exports use-case modules", async () => {
    const mod = await import("./index.js");
    expect(mod).toBeTruthy();
  });
});
