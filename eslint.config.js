import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: ["**/dist/**", "**/node_modules/**", "apps/web/src/routeTree.gen.ts"],
  },
  {
    files: ["packages/domain/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "drizzle-orm",
                "drizzle-orm/*",
                "fastify",
                "fastify/*",
                "react",
                "react/*",
                "zod",
                "@stock-management/shared",
                "@stock-management/application",
                "@stock-management/api",
              ],
              message:
                "Domain must stay pure — no Zod, Drizzle, Fastify, React, or outer packages.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/application/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "drizzle-orm",
                "drizzle-orm/*",
                "fastify",
                "fastify/*",
                "react",
                "react/*",
                "zod",
                "@stock-management/shared",
                "@stock-management/api",
              ],
              message:
                "Application may import @stock-management/domain only — no frameworks.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@stock-management/domain",
                "@stock-management/application",
                "drizzle-orm",
                "drizzle-orm/*",
              ],
              message:
                "Web is presentation only — use HTTP + @stock-management/shared DTOs.",
            },
          ],
        },
      ],
    },
  },
];
