const parser = require("@typescript-eslint/parser");
const plugin = require("@typescript-eslint/eslint-plugin");

module.exports = [
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser,
      parserOptions: {ecmaVersion: "latest", sourceType: "module"},
    },
    plugins: {"@typescript-eslint": plugin},
    rules: {
      ...plugin.configs.recommended.rules,
      "no-unused-vars": "off",
    },
  },
];
