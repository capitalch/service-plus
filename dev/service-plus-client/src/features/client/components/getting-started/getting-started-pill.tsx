import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, Check, ChevronDown, PartyPopper, Rocket } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MESSAGES } from "@/constants/messages";
import { useHelp } from "@/features/client/components/layout/client-layout";
import { cn } from "@/lib/utils";

import { useGettingStarted } from "./use-getting-started";
import type { GettingStartedStepStateType } from "./use-getting-started";

// ─── One step of the list ─────────────────────────────────────────────────────

type StepRowPropsType = {
	expanded: boolean;
	isNext: boolean;
	number: number;
	onGo: (step: GettingStartedStepStateType) => void;
	onShowMe: (step: GettingStartedStepStateType) => void;
	onToggle: () => void;
	step: GettingStartedStepStateType;
};

const StepRow = ({ expanded, isNext, number, onGo, onShowMe, onToggle, step }: StepRowPropsType) => (
	<li
		className={cn(
			"rounded-lg border transition-colors",
			isNext ? "border-(--cl-accent)/40 bg-(--cl-accent)/5" : "border-transparent",
		)}
	>
		<button
			aria-expanded={expanded}
			className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-(--cl-hover)"
			type="button"
			onClick={onToggle}
		>
			<span
				className={cn(
					"flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
					step.done
						? "bg-emerald-600 text-white"
						: isNext
							? "bg-(--cl-accent) text-white"
							: "border border-(--cl-border) text-(--cl-text-muted)",
				)}
			>
				{step.done ? <Check className="size-3.5" strokeWidth={3} /> : number}
			</span>
			<span
				className={cn(
					"min-w-0 flex-1 text-sm",
					step.done ? "text-(--cl-text-muted) line-through" : "font-medium text-(--cl-text)",
				)}
			>
				{step.label}
			</span>
			<ChevronDown
				className={cn("size-4 shrink-0 text-(--cl-text-muted) transition-transform", expanded && "rotate-180")}
			/>
		</button>
		{expanded && (
			<div className="flex flex-col gap-2.5 px-2.5 pb-2.5 pl-11">
				<p className="text-xs leading-relaxed text-(--cl-text-muted)">{step.hint}</p>
				<div className="flex flex-wrap items-center gap-2">
					<button
						className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-(--cl-accent) px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
						type="button"
						onClick={() => onGo(step)}
					>
						Go there
						<ArrowRight className="size-3.5" />
					</button>
					<button
						className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-(--cl-accent) hover:bg-(--cl-hover)"
						type="button"
						onClick={() => onShowMe(step)}
					>
						<BookOpen className="size-3.5" />
						Show me
					</button>
				</div>
			</div>
		)}
	</li>
);

// ─── Pill + panel ─────────────────────────────────────────────────────────────

/** The "Getting started" pill in the client top bar and its checklist panel (plans/plan.md).
 *  Shown to a Manager or Admin until the BU's first job is delivered. */
export const GettingStartedPill = () => {
	const gs = useGettingStarted();
	const navigate = useNavigate();
	const { openHelp } = useHelp();
	const [open, setOpen] = useState(false);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const { autoOpen, markSeen } = gs;

	// Opens by itself once per user per BU, the first time an unfinished checklist is seen.
	useEffect(() => {
		if (!autoOpen) return;
		setOpen(true);
		markSeen();
	}, [autoOpen, markSeen]);

	if (!gs.visible) return null;

	function handleOpenChange(next: boolean) {
		setOpen(next);
		if (next) {
			gs.refetch();
			gs.markSeen();
			setExpandedId(gs.nextStep?.id ?? null);
		} else if (gs.allDone) {
			gs.markDoneShown();
		}
	}

	function handleGo(step: GettingStartedStepStateType) {
		setOpen(false);
		navigate(step.target.route, { state: { subGroup: step.target.subGroup, subItem: step.target.subItem } });
	}

	function handleShowMe(step: GettingStartedStepStateType) {
		setOpen(false);
		openHelp(step.helpArticleId);
	}

	const total = gs.steps.length;
	const percent = Math.round((gs.doneCount / total) * 100);
	const expanded = expandedId ?? gs.nextStep?.id ?? null;

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				{/* The top nav's highlighted colour (--cl-accent) with white text, kept to the height of its neighbours, with a pulsing
				    "to do" dot. The pulse stops for anyone who prefers reduced motion. */}
				<button
					aria-label={`Getting started, ${gs.doneCount} of ${total} done`}
					className="group relative flex h-8 shrink-0 cursor-pointer items-center gap-2.5 rounded-full bg-(--cl-accent) pr-1 pl-3 text-sm font-semibold tracking-wide text-white shadow-sm shadow-(--cl-accent)/30 transition-[background-color,box-shadow] duration-200 ease-out hover:bg-(--cl-accent)/90 hover:shadow-md hover:shadow-(--cl-accent)/40 focus-visible:ring-2 focus-visible:ring-(--cl-accent)/40 focus-visible:outline-none"
					type="button"
				>
					{!gs.allDone && (
						<span aria-hidden className="absolute -top-0.5 -right-0.5 flex size-3">
							<span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-500 opacity-75 motion-reduce:animate-none" />
							<span className="relative inline-flex size-3 rounded-full border border-white bg-amber-700" />
						</span>
					)}
					{gs.allDone ? <PartyPopper className="size-4" /> : <Rocket className="size-4" />}
					<span className="hidden sm:inline">Getting started</span>
					<span className="rounded-full bg-white px-2 py-0.5 text-xs leading-tight font-bold text-(--cl-accent) tabular-nums">
						{gs.doneCount}/{total}
					</span>
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="w-[calc(100vw-1.5rem)] border-(--cl-border) bg-(--cl-surface) p-0 text-(--cl-text) sm:w-96"
				sideOffset={8}
			>
				<div className="border-b border-(--cl-border) p-4">
					<div className="flex items-center gap-2">
						<span className="flex size-8 items-center justify-center rounded-lg bg-(--cl-accent)/10 text-(--cl-accent)">
							<Rocket className="size-4" />
						</span>
						<div className="min-w-0">
							<p className="text-sm font-semibold">Getting started</p>
							<p className="text-xs text-(--cl-text-muted)">{MESSAGES.GS_INTRO}</p>
						</div>
					</div>
					<div className="mt-3 flex items-center gap-2">
						<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--cl-border)">
							<div
								className="h-full rounded-full bg-emerald-600 transition-all"
								style={{ width: `${percent}%` }}
							/>
						</div>
						<span className="text-xs font-medium text-(--cl-text-muted) tabular-nums">
							{gs.doneCount} of {total}
						</span>
					</div>
				</div>

				{gs.allDone ? (
					<div className="flex flex-col items-center gap-2 p-6 text-center">
						<span className="flex size-10 items-center justify-center rounded-full bg-emerald-600 text-white">
							<Check className="size-5" strokeWidth={3} />
						</span>
						<p className="text-sm font-semibold">{MESSAGES.GS_ALL_DONE}</p>
					</div>
				) : (
					<ol className="flex max-h-[60vh] flex-col gap-1 overflow-auto p-2">
						{gs.steps.map((step, index) => (
							<StepRow
								expanded={expanded === step.id}
								isNext={gs.nextStep?.id === step.id}
								key={step.id}
								number={index + 1}
								step={step}
								onGo={handleGo}
								onShowMe={handleShowMe}
								onToggle={() => setExpandedId(expanded === step.id ? "" : step.id)}
							/>
						))}
					</ol>
				)}

				<div className="flex justify-end border-t border-(--cl-border) px-3 py-2">
					<button
						className="cursor-pointer rounded px-2 py-1 text-xs text-(--cl-text-muted) hover:bg-(--cl-hover) hover:text-(--cl-text)"
						type="button"
						onClick={() => handleOpenChange(false)}
					>
						Close
					</button>
				</div>
			</PopoverContent>
		</Popover>
	);
};
