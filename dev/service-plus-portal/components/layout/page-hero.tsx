import { SectionHeading } from "@/components/layout/section-heading";
import { cn } from "@/lib/utils";

type PageHeroPropsType = {
	children?: React.ReactNode;
	className?: string;
	eyebrow?: string;
	intro?: string;
	/** Left-aligns the block, which reads better for long intros than a centred column. */
	align?: "center" | "start";
	title: string;
};

/** The header block every inner page opens with. Five pages each hand-rolled their own copy of
 *  this, which is how the padding and grid treatment drifted apart. */
export const PageHero = ({ align = "center", children, className, eyebrow, intro, title }: PageHeroPropsType) => {
	return (
		<section className={cn("bg-grid relative overflow-hidden", className)}>
			{/* Gradient wash fading into the page, so the hero has depth without a hard bottom edge. */}
			<div
				aria-hidden
				className="from-primary/12 pointer-events-none absolute inset-0 bg-gradient-to-b to-transparent"
			/>
			<div className="relative mx-auto w-full max-w-6xl px-page py-14 sm:py-18 lg:px-page-lg lg:py-section-lg">
				<SectionHeading align={align} eyebrow={eyebrow} intro={intro} level="h1" title={title} />
				{children}
			</div>
		</section>
	);
};
