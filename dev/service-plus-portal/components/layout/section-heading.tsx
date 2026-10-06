import { cn } from "@/lib/utils";

type SectionHeadingPropsType = {
	align?: "center" | "start";
	className?: string;
	eyebrow?: string;
	/** Recolours the eyebrow. Passed a stage accent so each section wears its own hue. */
	eyebrowClassName?: string;
	intro?: string;
	/** A page hero owns the h1; a section inside it owns the h2. */
	level?: "h1" | "h2";
	title: string;
};

export const SectionHeading = ({
	align = "center",
	className,
	eyebrow,
	eyebrowClassName,
	intro,
	level = "h2",
	title,
}: SectionHeadingPropsType) => {
	const Heading = level;
	const centered = align === "center";

	return (
		<div className={cn(centered && "mx-auto max-w-2xl text-center", className)}>
			{eyebrow && (
				<p className={cn("text-primary text-sm font-semibold tracking-wide uppercase", eyebrowClassName)}>
					{eyebrow}
				</p>
			)}
			<Heading
				className={cn(
					"font-bold tracking-tight",
					level === "h1" ? "mt-2 text-3xl sm:text-4xl lg:text-5xl" : "mt-2 text-3xl sm:text-4xl",
				)}
			>
				{title}
			</Heading>
			{intro && <p className="text-muted-foreground mt-3 sm:text-lg">{intro}</p>}
		</div>
	);
};
