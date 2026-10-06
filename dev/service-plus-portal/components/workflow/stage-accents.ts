/** The accent used for every stage of the journey: stage numbers, icons, eyebrows, section washes
 *  and the stage cards.
 *
 *  This used to be one hue per stage (sky, violet, orange, indigo, emerald, cyan). Stacked on top
 *  of the status colours that gave the page a dozen competing hues, and the pale tints left text
 *  and icons low on contrast. Stages are already told apart by their number and position, so they
 *  now share the site's primary, and the grounds behind them are neutral. Colour on this page is
 *  reserved for meaning: the four status groups in `status-tones.ts`.
 *
 *  Every class is written out in full — Tailwind only generates literal class strings. */
export type StageAccentType = {
	/** Solid dot for lists, legends and numbered discs. */
	dot: string;
	/** Hover ring for a card belonging to this stage. */
	hoverRing: string;
	/** Tinted square behind a stage icon. */
	icon: string;
	/** Text colour for stage numbers and labels. */
	label: string;
	/** Ring utilities for the active or selected state. */
	ring: string;
	/** Pale ground for a section that belongs to this stage. */
	wash: string;
};

export const STAGE_ACCENT: StageAccentType = {
	dot: "bg-primary",
	hoverRing: "hover:ring-primary/50",
	icon: "bg-primary/12 text-primary",
	label: "text-primary",
	ring: "ring-2 ring-primary/50",
	wash: "bg-slate-50 dark:bg-slate-900/30",
};
