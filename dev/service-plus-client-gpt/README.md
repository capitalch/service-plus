# Service Plus Client

Modern React application built with TypeScript, Vite, and enterprise-grade tools.

## Tech Stack

- **React 19** + **TypeScript** - UI and type safety
- **Vite** - Build tool and dev server
- **Redux Toolkit** - Global state management
- **Apollo Client** - GraphQL client with authentication
- **React Router v7** - Client-side routing
- **React Hook Form** + **Zod** - Form handling and validation
- **shadcn/ui** + **Tailwind CSS v4** - UI components and styling
- **Framer Motion** - Animations
- **Sonner** - Toast notifications
- **GraphQL Codegen** - Generate TypeScript types from GraphQL

## Getting Started

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start development server
pnpm start
```

## Project Structure

```
src/
├── components/        # React components
├── constants/        # Centralized messages and constants
├── lib/              # Apollo Client, utilities, helpers
├── router/           # React Router configuration
├── store/            # Redux store and typed hooks
├── App.tsx           # Root component
└── main.tsx          # Entry point with providers
```

## Available Scripts

- `pnpm start` - Start development server (port 3001)
- `pnpm build` - Build for production
- `pnpm lint` - Run ESLint
- `pnpm codegen` - Generate GraphQL types

## Development Guidelines

See `CLAUDE.md` for detailed development conventions.

**Key Conventions:**
- Arrow functions for components/hooks
- Normal functions for utilities/API helpers
- Centralized messages in `constants/messages.ts`
- Red color only for errors and required field indicators
- GraphQL with auth headers for protected API calls
