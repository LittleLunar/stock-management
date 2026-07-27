import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const localesDir = join(__dirname, "locales");

describe("i18n locale key parity", () => {
  const enFiles = readdirSync(join(localesDir, "en")).filter((f) =>
    f.endsWith(".json"),
  );

  it("has matching th files for every en namespace", () => {
    for (const file of enFiles) {
      const th = join(localesDir, "th", file);
      expect(() => readFileSync(th, "utf8")).not.toThrow();
    }
  });

  it.each(enFiles)("%s keys match between en and th", (file) => {
    const en = JSON.parse(
      readFileSync(join(localesDir, "en", file), "utf8"),
    ) as Record<string, string>;
    const th = JSON.parse(
      readFileSync(join(localesDir, "th", file), "utf8"),
    ) as Record<string, string>;
    expect(Object.keys(th).sort()).toEqual(Object.keys(en).sort());
  });
});
