import tseslint from "typescript-eslint";
export default tseslint.config(...tseslint.configs.recommended, {
  files: ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts", "tests/**/*.tsx"],
  rules: { "@typescript-eslint/consistent-type-imports": "error" },
});
