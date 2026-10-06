import { Reveal } from "@/components/layout/reveal";
import { cn } from "@/lib/utils";

type WorkflowSectionPropsType = {
	children: React.ReactNode;
	className?: string;
	/** Short kicker above the section title — Stages, Roles, Money. */
	eyebrow: string;
	id?: string;
	intro?: string;
	/** Puts a short intro on the title's line instead of under it. Used by the map, whose intro is a
	 *  single sentence and whose vertical space goes to the diagram. */
	introBeside?: boolean;
	/** The page opens with one of its sections, so the first one carries the h1. */
	level?: "h1" | "h2";
	/** Less vertical padding, for the map, so the heading, the path list and the diagram fit on one screen. */
	tight?: boolean;
	title: string;
};

/** One wrapper for every section on the workflow page. Every section shares one content width, so
 *  the page's edges stay put while scrolling; headings sit flush left like a document; and sections
 *  are divided by a hairline rule rather than coloured grounds. */
export const WorkflowSection = ({
	children,
	className,
	eyebrow,
	id,
	intro,
	introBeside = false,
	level = "h2",
	tight = false,
	title,
}: WorkflowSectionPropsType) => {
	const Heading = level;

	return (
		// scroll-mt clears the site header and the sticky section nav under it.
		<section
			className={cn("border-t border-border first-of-type:border-t-0", id && "scroll-mt-32", className)}
			id={id}
		>
			<div
				className={cn(
					"mx-auto w-full max-w-7xl px-page lg:px-page-lg",
					tight ? "pt-6 pb-10 lg:pt-7" : "py-12 lg:py-16",
				)}
			>
				<div className={cn("max-w-3xl", tight ? "mb-5" : "mb-8")}>
					<p className="text-primary text-xs font-semibold tracking-wider uppercase">{eyebrow}</p>
					<div className={cn(introBeside ? "mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1" : "mt-1.5")}>
						<Heading
							className={cn(
								"font-bold tracking-tight",
								level === "h1" ? "text-3xl lg:text-4xl" : "text-2xl lg:text-3xl",
							)}
						>
							{title}
						</Heading>
						{intro && <p className={cn("text-muted-foreground", !introBeside && "mt-2")}>{intro}</p>}
					</div>
				</div>
				<Reveal y={12}>{children}</Reveal>
			</div>
		</section>
	);
};
