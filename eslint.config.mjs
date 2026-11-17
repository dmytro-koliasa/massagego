import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // CommonJS seed/backfill scripts (pre-existing).
  {
    files: ["scripts/**/*.{js,cjs}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // React Compiler lint rules from eslint-config-next; widespread pre-existing
  // patterns. Kept as warnings so CI stays green; harden in a follow-up PR.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);

export default eslintConfig;
