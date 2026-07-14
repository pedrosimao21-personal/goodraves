import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// eslint-config-next v16 ships native flat configs, so we spread them directly
// instead of loading the legacy shareable configs through FlatCompat. The old
// FlatCompat path routed through @eslint/eslintrc, whose config validator
// crashed ("Converting circular structure to JSON") on eslint-plugin-react's
// self-referential flat config.
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  { ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"] },
  {
    rules: {
      // The DB JSON-blob and external-API layers use `any` deliberately and
      // pervasively. Surface it as a warning rather than failing the lint gate;
      // tighten incrementally if those layers gain real types.
      "@typescript-eslint/no-explicit-any": "warn",
      // eslint-config-next v16 turns on this React-Compiler-era rule as an error.
      // Syncing state inside effects (hydrating fetched data, resetting on id
      // change) is used throughout the app and is intentional; warn instead of
      // blocking the lint gate.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default eslintConfig;
