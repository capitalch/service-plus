import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type TileCardPropsType = {
	description: string;
	/** Turns the title into a link and reveals the "learn more" affordance. */
	href?: Route;
	icon: LucideIcon;
	/** Overrides the default icon chip. */
	iconClassName?: string;
	title: string;
};

/** The one card used by the feature grid and the owner-benefit grid. Those two were 12 near
 *  identical articles with the icon, heading and paragraph copy-pasted between them, which is
 *  how their hover states ended up out of step with each other. */
export const TileCard = ({ description, href, icon: Icon, iconClassName, title }: TileCardPropsType) => {
	const body = (
		<>
			<span
				className={cn(
					"bg-primary/10 text-primary group-hover:bg-gradient-brand group-hover:text-white",
					"flex size-11 items-center justify-center rounded-xl transition-colors duration-300",
					iconClassName,
				)}
			>
				<Icon aria-hidden className="size-5" />
			</span>
			<h3 className="mt-4 font-semibold">{title}</h3>
			<p className="text-muted-foreground mt-2 text-sm">{description}</p>
			{href && (
				<span className="text-primary mt-4 inline-flex items-center gap-1 text-sm font-medium">
					See how it works
					<ArrowRight
						aria-hidden
						className="size-4 transition-transform duration-300 group-hover:translate-x-1"
					/>
				</span>
			)}
		</>
	);

	const className = "card-lift group bg-card flex h-full flex-col rounded-2xl border border-border p-5 shadow-xs";

	if (href) {
		return (
			<Link
				className={cn(
					className,
					"focus-visible:ring-primary/40 focus-visible:ring-3 focus-visible:outline-none",
				)}
				href={href}
			>
				{body}
			</Link>
		);
	}

	return <article className={className}>{body}</article>;
};
