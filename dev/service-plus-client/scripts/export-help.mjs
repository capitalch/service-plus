// Copies the Help articles to the server for Ask AI (service-plus-server/app/ai_help/):
// client staff help → help_articles.json, Super Admin developer help → dev_help_articles.json.
// Vite's own loader handles the `@/` paths and the `.tsx` icon imports in the content files.
// `pnpm build` runs this first; run `pnpm export-help` by hand after editing either content file.
import { writeFileSync } from "node:fs";
import { createServer } from "vite";

const OUT_DIR = "../service-plus-server/app/ai_help";
const SOURCES = [
	{
		exportName: "HELP_ARTICLES",
		file: "help_articles.json",
		module: "/src/features/client/components/help/help-content.ts",
	},
	{
		exportName: "DEV_HELP_ARTICLES",
		file: "dev_help_articles.json",
		module: "/src/features/super-admin/components/help/dev-help-content.ts",
	},
];

const server = await createServer({
	appType: "custom",
	logLevel: "error",
	server: { hmr: false, middlewareMode: true },
});
for (const { exportName, file, module } of SOURCES) {
	const articles = (await server.ssrLoadModule(module))[exportName];
	const out = articles.map(({ category, content, faqs, id, summary, tags, title }) => ({
		category,
		content,
		faqs,
		id,
		summary,
		tags,
		title,
	}));
	writeFileSync(`${OUT_DIR}/${file}`, JSON.stringify(out, null, "\t") + "\n");
	console.log(`Exported ${out.length} help articles to ${OUT_DIR}/${file}`);
}
await server.close();
