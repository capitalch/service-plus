import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
    schema: process.env.VITE_GRAPHQL_URL || 'http://localhost:8000/graphql',
    documents: ['src/graphql/**/*.graphql'],
    generates: {
        'src/graphql/generated/': {
            preset: 'client',
            presetConfig: {
                gqlTagName: 'gql',
            },
        },
    },
    ignoreNoDocuments: true,
};

export default config;
