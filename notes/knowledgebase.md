## Server
# **Creating and activating virtual env in windows in context of Trace**
Download and Install Python from installer
cd c:\projects\trace-plus
1. python -m pip install virtualenv
2. python -m venv env
3. env\Scripts\activate

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



