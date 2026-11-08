import { defineConfig, globalIgnores } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import stylistic from "@stylistic/eslint-plugin";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([
    globalIgnores(["**/*.js", "**/*.cjs", "**/*.mjs", "**/*.d.ts",]),
    {
            extends: compat.extends(
            "eslint:recommended",
            "plugin:@typescript-eslint/eslint-recommended",
            "plugin:@typescript-eslint/recommended",
            "plugin:prettier/recommended",
        ),

        plugins: {
            "@typescript-eslint": typescriptEslint,
            "@stylistic": stylistic
        },

        languageOptions: {
            parser: tsParser,
            ecmaVersion: 5,
            sourceType: "module",

            parserOptions: {
                project: "tsconfig.json",
                tsconfigRootDir: __dirname,
            },
        },

        rules: {
            "@typescript-eslint/naming-convention": ["error", {
                selector: "interface",
                format: ["PascalCase"],

                custom: {
                    regex: "^I[A-Z]",
                    match: true,
                },
            }],

            "@typescript-eslint/no-unused-vars": ["warn", {
                args: "none",
            }],

            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-namespace": "off",
            "@typescript-eslint/no-use-before-define": "off",

            "@stylistic/quotes": ["error", "single", {
                avoidEscape: true,
                allowTemplateLiterals: "never",
            }],

            curly: ["error", "all"],
            eqeqeq: "error",
            "prefer-arrow-callback": "error",
        },
    }
]);