import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: process.env.VITE_GRAPHQL_HTTP_URL || "http://localhost:4000/graphql",
  documents: ["src/**/*.{ts,tsx}", "!src/generated/**/*"],
  generates: {
    "./src/generated/graphql.ts": {
      plugins: [
        "typescript",
        "typescript-operations",
        "typescript-react-apollo",
      ],
      config: {
        withHooks: true,
        withHOC: false,
        withComponent: false,
        skipTypename: false,
        dedupeFragments: true,
      },
    },
  },
  ignoreNoDocuments: true,
};

export default config;
