import { benefits } from "@/content/features";

export const BenefitStrip = () => {
	return (
		<section className="border-y border-border/60 bg-card/60">
			<dl className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-6 px-4 py-8 lg:grid-cols-4 lg:px-6">
				{benefits.map((benefit) => (
					<div className="text-center" key={benefit.label}>
						<dt className="text-gradient-brand text-2xl font-bold sm:text-3xl">{benefit.value}</dt>
						<dd className="mt-1 text-sm text-muted-foreground">{benefit.label}</dd>
					</div>
				))}
			</dl>
		</section>
	);
};
