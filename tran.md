# Service management software
- Client side
	- Vite + react
	- Redux
	- Syncfusion grid
	- GraphQL
	- Tailwind
	- lucide-react
- Learning stack
	- pnpm package manager
	- GraphQL Subscriptions support
	- Consider shadcn/ui
		- shadcn for forms, dialogs, dropdowns
	- Zod (Schema = Single Source of Truth)
		- Use Zod for:
			- Form validation
			- GraphQL input validation
			- Client-side business rules
	- RTK Query (Yes, even with GraphQL)
		- REST fallback endpoints
		- File uploads
		- Reports export
		- Auth / session APIs
	- Role-Based Access Control (VERY important)
		- Custom RBAC hook
		- Driven by JWT claims or GraphQL roles
	- Command Palette (Optional but powerful)
		- npm i cmdk
	- Notifications
		- npm i sonner
	- Modals & Transitions
		- npm i framer-motion

- Linting and formatting
	- npm i -D eslint prettier eslint-config-prettier

- type Safety
	- Enable strict mode in tsconfig
	- Generate GraphQL types using codegen
		- npm i @graphql-codegen/cli

- Folder
src/
 ├─ app/              # store, apollo, providers
 ├─ features/         # service, client, billing
 │   ├─ service/
 │   │   ├─ ServiceList.tsx
 │   │   ├─ ServiceForm.tsx
 │   │   ├─ service.slice.ts
 │   │   └─ service.gql.ts
 ├─ components/       # shared UI
 ├─ hooks/
 ├─ utils/
 ├─ routes/
 └─ types/

 - **Folder Structure Alternative**
```
src/
├── components/
│   ├── ui/              # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   └── ...
│   ├── tickets/
│   │   ├── TicketGrid.tsx
│   │   ├── TicketForm.tsx
│   │   ├── TicketDetails.tsx
│   │   └── TicketFilters.tsx
│   ├── clients/
│   ├── technicians/
│   └── shared/
├── features/           # Feature-based organization
│   ├── tickets/
│   │   ├── api/
│   │   │   ├── queries.ts
│   │   │   ├── mutations.ts
│   │   │   └── subscriptions.ts
│   │   ├── hooks/
│   │   │   ├── useTickets.ts
│   │   │   └── useTicketFilters.ts
│   │   ├── types.ts
│   │   └── utils.ts
│   ├── clients/
│   └── scheduling/
├── lib/
│   ├── apollo-client.ts
│   ├── utils.ts
│   └── constants.ts
├── stores/
│   ├── ui-store.ts
│   └── auth-store.ts
├── routes/
│   ├── tickets.tsx
│   ├── clients.tsx
│   └── dashboard.tsx
└── App.tsx

