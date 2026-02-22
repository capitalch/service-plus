## Server
# **Creating and activating virtual env in windows in context of Trace**
Download and Install Python from installer
cd c:\projects\trace-plus
1. python -m pip install virtualenv
2. python -m venv env
3. env\Scripts\activate
# environment switching
- In production server, during startup, a startup.sh file runs which sets up APP_ENV environment variable (export APP_ENV=production)
- In code, env: str = os.getenv("APP_ENV", "dev")  # default to development, line gets the environment. Based on the value of APP_ENV you can switch values

## Service management software client
# pnpm: node 17 has it
	- Steps:
		- corepack enable pnpm
		- pnpm create vite service-app --template react-ts

# pnpm dlx: same as npmx

## Start a project with tailwind v4 + vite + shadcn
- Best is create a project from shadcn home page. This gives you a cli script. Run it and project is auto created
## Tools
	- For themes use tweakcn
	- Use v0 as an AI tool

## add sonner
pnpm dlx shadcn@latest add sonner

## shadcn: Create the new project from shadcn site
- To add a new component say button or chart
	pnpm dlx shadcn@latest add button
	pnpm dlx shadcn@latest add chart

- eslint error when add a shadcn component. Do this change ineslint.config.js. add rules:
	rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },

- folder alias @
	@/: This is the alias. By convention in Vite or Next.js projects, it usually points to your src/ folder
	It is configured in tsconfig.json file:
	"paths": {
      "@/*": "./src/*"]
    }

- conditional styling in shadcn
	there is a function cn in lib/utility. This is intelligent merge, better than clsx. It returns twMerge(clsx(inputs))
	use this in place of clsx and it will make only the intended class effective.
	Ex: className={cn(
        "rounded-none active:translate-y-1 transition-transform relative inline-flex items-center justify-center gap-1.5 border-none m-1.5 cursor-pointer",
        size === "icon" && "mx-1 my-0",
        font !== "normal" && "retro",
        className
      )}
# Third party vendors for shadcn
- there are many third party libraries which provide various components. They are caled registries. The components can be added from these registries. They are listed in shadcn site
	To add from these: pnpm dlx shadcn@latest add @8bitcn/button. here @8bitcn is one such vendor or registry
- There are some complex components like login also available with them

## Redux steps
# Step 1: Create store
# Step 2: Create Provider at index.tsx and set the store in provider
# Step 3: Create slice and export reducer and actions
- One slice has multiple actions but one reducer
# Step 4: Assign reducer to store. 
	- Likewise you can create many slices and each slice has corresponding reducer
	- In store write all the reducers
# Step 5: use actions
- In components make use of useSelectors and dispath
- In dispatch make use of actions

## Postgress to typescript types conversion: used pg-to-ts
	- pnpm install -D pg-to-ts dotenv-cli cross-var cross-env
		dotenv-cli make available the contents of .env file as environment variable
	- set the .env file. PG_TO_TS_CONN is fixed variable pg-to-ts searches in environment variables
		We can do in .env file: PG_TO_TS_CONN=postgresql://webadmin:pwd@host:port/service_plus_demo
	- In package.json scripts:
		"gen-types-service": "dotenv -- pg-to-ts generate --schema demo1 -o src/types/db-schema-service.ts",
	    "gen-types-security": "dotenv -- pg-to-ts generate --schema security -o src/types/db-schema-security.ts",
	    "gen-types-client": "dotenv -- pg-to-ts generate -o src/types/db-schema-client.ts",
	    "gen-types-all": "pnpm run gen-types-service && npm run gen-types-security && npm run gen-types-client"
	- pnpm gen-types-all 
		dotenv -- makes available the PG_TO_TS_CONN to pg-to-ts generate command
	- But we want three different schemas with 2 different databases, hence above will not work out. We need to use ross-var cross-env as follows. This worked.
		- pnpm install -D pg-to-ts dotenv-cli cross-var cross-env
		- .env file:
			SERVICE_PLUS_SERVICE=postgresql://webadmin:pwd@host:port/service_plus_demo
			SERVICE_PLUS_CLIENT=postgresql://webadmin:pwd@host:port/service_plus_client
		- package.json scripts
			"gen-types-service": "dotenv -- cross-var cross-env PG_TO_TS_CONN=%SERVICE_PLUS_SERVICE% pg-to-ts generate --schema demo1 -o src/types/db-schema-service.ts",
		    "gen-types-security": "dotenv -- cross-var cross-env PG_TO_TS_CONN=%SERVICE_PLUS_SERVICE% pg-to-ts generate --schema security -o src/types/db-schema-security.ts",
		    "gen-types-client": "dotenv -- cross-var cross-env PG_TO_TS_CONN=%SERVICE_PLUS_CLIENT% pg-to-ts generate -o src/types/db-schema-client.ts",
		    "gen-types-all": "pnpm run gen-types-service && pnpm run gen-types-security && pnpm run gen-types-client"


