"use client";

import { useEffect, useState } from "react";

import { MESSAGES } from "@/constants/messages";
import { workflowSections } from "@/content/workflow";
import { cn } from "@/lib/utils";

/** Sticky row of section links under the site header. The page is long and was a single scroll
 *  with no way to move between its parts; this gives it a table of contents that stays in reach
 *  and marks the section currently on screen. */
export const SectionNav = () => {
	const [active, setActive] = useState(workflowSections[0].id);

	// A section counts as visible while it crosses a band just below the two sticky bars. Of the
	// visible ones the earliest in page order wins, so a short section scrolling into the band
	// cannot steal the highlight from the one the reader is still in.
	useEffect(() => {
		const visible = new Set<string>();
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) visible.add(entry.target.id);
					else visible.delete(entry.target.id);
				}
				const first = workflowSections.find((section) => visible.has(section.id));
				if (first) setActive(first.id);
			},
			{ rootMargin: "-140px 0px -65% 0px" },
		);
		for (const section of workflowSections) {
			const element = document.getElementById(section.id);
			if (element) observer.observe(element);
		}
		return () => observer.disconnect();
	}, []);

	return (
		<nav
			aria-label={MESSAGES.workflowSectionsNav}
			className="bg-background/90 sticky top-16 z-30 border-b border-border backdrop-blur-xl"
		>
			<ol className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-page py-2 lg:px-page-lg">
				{workflowSections.map((section, index) => {
					const current = section.id === active;
					return (
						<li className="shrink-0" key={section.id}>
							<a
								aria-current={current ? "location" : undefined}
								className={cn(
									"flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
									current
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:bg-muted hover:text-foreground",
								)}
								href={`#${section.id}`}
							>
								<span
									className={cn(
										"text-xs tabular-nums",
										current ? "text-primary-foreground/75" : "text-muted-foreground/70",
									)}
								>
									{index + 1}
								</span>
								{section.label}
							</a>
						</li>
					);
				})}
			</ol>
		</nav>
	);
};
