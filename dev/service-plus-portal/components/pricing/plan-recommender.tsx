"use client";

import { ArrowRight, Check, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Reveal } from "@/components/layout/reveal";
import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { findPlan, formatInr, type PlanCodeType, type PlanType } from "@/content/pricing";
import { findLivePlan, usePlanPrices } from "@/lib/plan-prices";
import { cn } from "@/lib/utils";

type QuestionType = {
	id: string;
	options: { label: string; value: number }[];
	prompt: string;
};

const questions: QuestionType[] = [
	{
		id: "team",
		options: [
			{ label: "Just me", value: 1 },
			{ label: "2–3 people", value: 2 },
			{ label: "4 or more", value: 3 },
		],
		prompt: "How many people will use it?",
	},
	{
		id: "inventory",
		options: [
			{ label: "No, jobs only", value: 0 },
			{ label: "Yes, we stock parts", value: 2 },
		],
		prompt: "Do you keep spare parts in stock?",
	},
	{
		id: "whatsapp",
		options: [
			{ label: "Not yet", value: 0 },
			{ label: "A few a week", value: 1 },
			{ label: "Most jobs", value: 2 },
		],
		prompt: "Do you send job updates on WhatsApp?",
	},
	{
		id: "branches",
		options: [
			{ label: "One", value: 0 },
			{ label: "2–5", value: 2 },
			{ label: "More than 5", value: 3 },
		],
		prompt: "How many branches or business units?",
	},
];

type AnswersType = Record<string, number>;

// The recommendation is derived from the plan definitions rather than a hand-written mapping, so
// it cannot drift from what the plans actually include. It walks the ladder and takes the first
// plan that covers every answer, which is why the ladder is ordered cheapest to dearest.
function recommend(answers: AnswersType): { plan: PlanType; reasons: string[] } {
	const needsInventory = (answers.inventory ?? 0) > 0;
	const needsMultiUser = (answers.team ?? 1) > 1;
	const needsWhatsapp = (answers.whatsapp ?? 0) > 0;
	const branches = answers.branches ?? 0;

	const reasons: string[] = [];
	if (needsMultiUser) reasons.push(MESSAGES.reasonTeam);
	if (needsInventory) reasons.push(MESSAGES.reasonInventory);
	if (needsWhatsapp) reasons.push(MESSAGES.reasonWhatsapp);
	if (branches === 2) reasons.push(MESSAGES.reasonBranches);
	if (branches >= 3) reasons.push(MESSAGES.reasonBusinessUnits);
	if (reasons.length === 0) reasons.push(MESSAGES.reasonStarter);

	const ladder: PlanCodeType[] = ["lite", "basic", "standard", "enterprise"];
	const code = ladder.find((candidate) => {
		const plan = findPlan(candidate);
		if (!plan) return false;
		if (needsInventory && !plan.inventory) return false;
		if (needsMultiUser && plan.users === "single") return false;
		if (needsWhatsapp && plan.whatsappPerMonth === 0) return false;
		if (branches >= 2 && plan.branches !== null) return false;
		if (branches >= 3 && plan.businessUnits < 2) return false;
		return true;
	});

	const plan = findPlan(code ?? "lite") ?? findPlan("standard")!;
	return { plan, reasons };
}

export const PlanRecommender = ({ onSelect }: { onSelect: (code: PlanCodeType) => void }) => {
	const [answers, setAnswers] = useState<AnswersType | null>(null);

	const { plans } = usePlanPrices();
	const result = answers ? recommend(answers) : null;
	// The recommendation reads the plan features; the price shown is the live one.
	const resultPlan = result ? (findLivePlan(plans, result.plan.code) ?? result.plan) : null;

	function answer(id: string, value: number) {
		setAnswers((current) => {
			const next = { ...current, [id]: value };
			// Keep every question answered once the visitor has started, so Back-free flow works.
			return next;
		});
	}

	return (
		<Reveal>
			<div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">
				<p className="text-primary text-sm font-semibold tracking-wide uppercase">
					{MESSAGES.recommenderEyebrow}
				</p>
				<h2 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">{MESSAGES.recommenderTitle}</h2>
				<p className="text-muted-foreground mt-2 text-sm">{MESSAGES.recommenderIntro}</p>

				<ol className="mt-6 grid gap-5 sm:grid-cols-2">
					{questions.map((question, index) => {
						const chosen = answers?.[question.id];
						return (
							<li key={question.id}>
								<p className="flex items-center gap-2 text-sm font-medium">
									<span className="bg-muted text-muted-foreground flex size-5 shrink-0 items-center justify-center rounded-full text-xs">
										{index + 1}
									</span>
									{question.prompt}
								</p>
								<div className="mt-2 flex flex-wrap gap-2">
									{question.options.map((option) => {
										const selected = chosen === option.value;
										return (
											<button
												aria-pressed={selected}
												className={cn(
													"rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
													selected
														? "border-primary bg-primary/10 text-primary font-medium"
														: "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
												)}
												key={option.label}
												onClick={() => answer(question.id, option.value)}
												type="button"
											>
												{option.label}
											</button>
										);
									})}
								</div>
							</li>
						);
					})}
				</ol>

				{result ? (
					// role="status" announces the recommendation as soon as the box appears.
					<div className="border-primary/30 bg-primary/5 mt-6 rounded-xl border p-5" role="status">
						<p className="text-muted-foreground text-sm">On your answers, we would set you up on</p>
						<p className="mt-1 flex items-baseline gap-2">
							<span className="text-2xl font-bold tracking-tight">{result.plan.name}</span>
							<span className="text-muted-foreground text-sm">
								{resultPlan?.monthlyPrice === 0
									? "Free"
									: `${formatInr(resultPlan?.monthlyPrice ?? 0)} / month`}
								{(resultPlan?.setupFee ?? 0) > 0 && ` + ${formatInr(resultPlan?.setupFee ?? 0)} setup`}
							</span>
						</p>
						<p className="text-muted-foreground mt-2 text-sm italic">{result.plan.tagline}</p>
						<ul className="mt-3 space-y-1.5">
							{result.reasons.map((reason) => (
								<li className="flex items-start gap-2 text-sm" key={reason}>
									<Check aria-hidden className="text-success mt-0.5 size-4 shrink-0" />
									{reason}
								</li>
							))}
						</ul>
						<div className="mt-4 flex flex-col gap-2 sm:flex-row">
							<Button onClick={() => onSelect(result.plan.code)} type="button">
								Choose {result.plan.name}
								<ArrowRight />
							</Button>
							<Button onClick={() => setAnswers(null)} type="button" variant="outline">
								<RotateCcw />
								Start again
							</Button>
						</div>
					</div>
				) : (
					<p className="text-muted-foreground mt-6 text-sm">
						Answer {questions.length} quick questions to see a recommendation.
					</p>
				)}
			</div>
		</Reveal>
	);
};
