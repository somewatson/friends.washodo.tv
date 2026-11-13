export default [
    {
        ignores: ["dist/**", "node_modules/**"],
    },
    {
        files: ["public/**/*.js"],
        languageOptions: {
            globals: {
                window: "readonly",
                document: "readonly",
                navigator: "readonly",
                console: "readonly",
            },
            ecmaVersion: "latest",
            sourceType: "module",
        },
        rules: {
            "no-unused-vars": "off",
            "no-console": "off",
        },
    },
    {
        files: ["src/**/*.ts"],
        languageOptions: {
            parser: (await import('@typescript-eslint/parser')).Parser,
            globals: {
                process: "readonly",
                console: "readonly",
            },
            ecmaVersion: "latest",
            sourceType: "module",
        },
        rules: {
            "no-console": "off",
        },
    },
];
