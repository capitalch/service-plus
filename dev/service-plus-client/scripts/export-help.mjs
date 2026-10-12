// Copies the client Help articles to the server for Ask AI (service-plus-server/app/ai_help/).
// Vite's own loader handles the `@/` paths and the `.tsx` icon import in help-content.ts.
// `pnpm build` runs this first; run `pnpm export-help` by hand after editing help-content.ts.
import { writeFileSync } from "node:fs";
import { createServer } from "vite";

const OUT_FILE = "../service-plus-server/app/ai_help/help_articles.json";

const server = await createServer({
	appType: "custom",
	logLevel: "error",
	server: { hmr: false, middlewareMode: true },
});
const { HELP_ARTICLES } = await server.ssrLoadModule("/src/features/client/components/help/help-content.ts");
await server.close();

const out = HELP_ARTICLES.map(({ category, content, faqs, id, summary, tags, title }) => ({
	category,
	content,
	faqs,
	id,
	summary,
	tags,
	title,
}));
writeFileSync(OUT_FILE, JSON.stringify(out, null, "\t") + "\n");
console.log(`Exported ${out.length} help articles to ${OUT_FILE}`);
