import { cn } from "@/lib/utils";

type SectionHeadingPropsType = {
	className?: string;
	eyebrow?: string;
	intro?: string;
	title: string;
};

export const SectionHeading = ({ className, eyebrow, intro, title }: SectionHeadingPropsType) => {
	return (
		<div className={cn("mx-auto max-w-2xl text-center", className)}>
			{eyebrow && <p className="text-sm font-semibold tracking-wide text-primary uppercase">{eyebrow}</p>}
			<h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
			{intro && <p className="mt-3 text-muted-foreground sm:text-lg">{intro}</p>}
		</div>
	);
};
