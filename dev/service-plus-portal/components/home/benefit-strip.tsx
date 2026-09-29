import { CountUp } from "@/components/layout/count-up";
import { Reveal } from "@/components/layout/reveal";
import { stats } from "@/content/stats";

/** The stat bar directly under the hero. The numbers are derived in content/stats.ts from the
 *  feature, pricing and screenshot content, so they stay true as the product changes. */
export const BenefitStrip = () => {
	return (
		<section className="border-y border-border/60 bg-card/60">
			<dl className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-6 px-page py-8 lg:grid-cols-4 lg:px-page-lg">
				{stats.map((stat, index) => (
					<Reveal delay={(index % 4) * 0.07} key={stat.label} y={16}>
						<div className="text-center">
							<dt className="text-gradient-brand text-3xl font-bold tabular-nums sm:text-4xl">
								<CountUp suffix={stat.suffix} value={stat.value} />
							</dt>
							<dd className="text-muted-foreground mx-auto mt-1 max-w-[22ch] text-sm text-balance">
								{stat.label}
							</dd>
						</div>
					</Reveal>
				))}
			</dl>
		</section>
	);
};
