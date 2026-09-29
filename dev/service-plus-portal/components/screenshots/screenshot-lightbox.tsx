"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { ScreenshotType } from "@/content/screenshots";

type ScreenshotLightboxPropsType = {
	/** The full set being browsed, so the arrows can walk past the thumbnail that was clicked. */
	shots: ScreenshotType[];
	/** null closes the dialog. */
	selectedIndex: number | null;
	onSelectedIndexChange: (index: number | null) => void;
};

export const ScreenshotLightbox = ({ onSelectedIndexChange, selectedIndex, shots }: ScreenshotLightboxPropsType) => {
	const open = selectedIndex !== null;
	const canPage = shots.length > 1;

	const go = useCallback(
		(delta: number) => {
			if (selectedIndex === null || shots.length < 2) return;
			onSelectedIndexChange((selectedIndex + delta + shots.length) % shots.length);
		},
		[onSelectedIndexChange, selectedIndex, shots.length],
	);

	// Arrow keys walk the set; Radix handles Escape itself. Bound to document rather than to the
	// dialog so the keys work while focus sits on the image or the close button.
	useEffect(() => {
		if (!open || !canPage) return;

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "ArrowRight") {
				event.preventDefault();
				go(1);
			} else if (event.key === "ArrowLeft") {
				event.preventDefault();
				go(-1);
			}
		};

		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [canPage, go, open]);

	// Narrowed here rather than above so TypeScript keeps selectedIndex as a number below, which
	// the counter needs. All hooks are already called, so returning early is safe.
	if (selectedIndex === null || !shots[selectedIndex]) return null;
	const active = shots[selectedIndex];

	return (
		<Dialog onOpenChange={(next) => !next && onSelectedIndexChange(null)} open={open}>
			<DialogContent className="max-w-[min(96vw,80rem)] gap-3 p-2 sm:max-w-[min(96vw,80rem)]">
				<div className="flex items-center justify-between gap-3 px-2 pt-1">
					<DialogTitle className="truncate">{active.caption}</DialogTitle>
					{canPage && (
						<p aria-live="polite" className="text-muted-foreground shrink-0 text-xs tabular-nums">
							{selectedIndex + 1} of {shots.length}
						</p>
					)}
				</div>
				<DialogDescription className="sr-only">{active.alt}</DialogDescription>

				<div className="relative">
					{/* eslint-disable-next-line @next/next/no-img-element -- static export, images unoptimized */}
					<img alt={active.alt} className="max-h-[72vh] w-full rounded-lg object-contain" src={active.src} />

					{canPage && (
						<>
							<Button
								aria-label="Previous screenshot"
								className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-background/85 shadow-md backdrop-blur-sm hover:bg-background"
								onClick={() => go(-1)}
								size="icon"
								type="button"
								variant="ghost"
							>
								<ChevronLeft />
							</Button>
							<Button
								aria-label="Next screenshot"
								className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-background/85 shadow-md backdrop-blur-sm hover:bg-background"
								onClick={() => go(1)}
								size="icon"
								type="button"
								variant="ghost"
							>
								<ChevronRight />
							</Button>
						</>
					)}
				</div>

				{canPage && (
					<p className="text-muted-foreground hidden px-2 pb-1 text-xs sm:block">
						Use the arrow keys to browse.
					</p>
				)}
			</DialogContent>
		</Dialog>
	);
};
