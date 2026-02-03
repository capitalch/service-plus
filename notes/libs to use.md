## Service management software
- A web app to completely manage 
# Final technology stack
	- Client side
		React + Typescript + Tailwind + ShadCN + lucideReact
		GraphQL
		React-hook-form + Zod
		Tanstack Query + Router
		Redux
		Command Pallette
		Notifications: Sonner
		framer-motion
		Linting and formatting: eslint prettier eslint-config-prettier
		Generate GraphQL types using codegen
		strict mode in tsconfig
	- Server side
		Database: PostGreSql
		Python fastApi + GraphQL + Pydantic
# Requirements
	- Service management
	- Spare parts inventory management
	- Role based access management
# To learn
- Client
	- Tanstack query and router
	- shadcn forms and zod
	- Framer motion
	- Playwrite
- Server
	- Temporal
	- cloudfare worker
- Productivity
	- TlDraw
	- Excaldraw
	- Linear

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

