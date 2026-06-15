import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  { ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // The DB JSON-blob and external-API layers use `any` deliberately and
      // pervasively. Surface it as a warning rather than failing the lint gate;
      // tighten incrementally if those layers gain real types.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

export default eslintConfig;
