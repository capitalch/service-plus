import { useCallback, useEffect, useMemo, useState } from "react";

import { SQL_MAP } from "@/constants/sql-map";
import { selectCurrentUser, selectDbName } from "@/features/auth/store/auth-slice";
import { useGenericQuery } from "@/features/client/components/reports/common/use-generic-query";
import { selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { GETTING_STARTED_STEPS } from "./getting-started-steps";
import type { GettingStartedProgressType, GettingStartedStepType } from "./getting-started-steps";

export type GettingStartedStepStateType = Omit<GettingStartedStepType, "done"> & { done: boolean };

type GettingStartedType = {
	/** Every step is done. Shown once ("You're all set"), then the pill goes away. */
	allDone: boolean;
	/** Open the panel by itself: once per login (or page reload) per BU, until every step is done. */
	autoOpen: boolean;
	doneCount: number;
	/** Remember that the "all set" state has been shown, so the pill goes away. */
	markDoneShown: () => void;
	/** The panel has been opened in this login: it does not open by itself again until the next one. */
	markSeen: () => void;
	nextStep: GettingStartedStepStateType | null;
	refetch: () => void;
	steps: GettingStartedStepStateType[];
	visible: boolean;
};

// "Seen" and "done shown" are per-browser conveniences, not data (plans/plan.md constraint 4): a
// failing storage only means the "all set" message is skipped. There is no way to hide the
// checklist for good — it goes away by itself after the first delivery.

// Logins (or page reloads) in which the panel already opened, per BU. Keyed on the session's
// user object, which only setCredentials (login) and a reload replace — a token refresh does not.
const openedInLogin = new WeakMap<object, Set<string>>();
function readFlag(key: string): boolean {
	try {
		return localStorage.getItem(key) === "1";
	} catch {
		return false;
	}
}

function writeFlag(key: string): void {
	try {
		localStorage.setItem(key, "1");
	} catch {
		// Storage unavailable (private window, blocked): nothing to remember.
	}
}

/** The "Getting started" checklist for the current BU: progress from the server, and whether it shows. */
export const useGettingStarted = (): GettingStartedType => {
	const user = useAppSelector(selectCurrentUser);
	const dbName = useAppSelector(selectDbName);
	const schema = useAppSelector(selectSchema);
	// Managers and Admins set up masters; the live demo is read-only.
	const eligible =
		!!user &&
		!user.isDemo &&
		!!schema &&
		(user.userType === "A" || (user.userType === "B" && user.roleCode === "MANAGER"));

	const query = useGenericQuery<GettingStartedProgressType>({
		enabled: eligible,
		sqlId: SQL_MAP.GET_GETTING_STARTED_PROGRESS,
	});
	const { refetch } = query;
	const progress = query.data[0] ?? null;

	// Re-read when the user comes back from doing a step in another tab or window.
	useEffect(() => {
		if (!eligible) return;
		window.addEventListener("focus", refetch);
		return () => window.removeEventListener("focus", refetch);
	}, [eligible, refetch]);

	const keyBase = `${dbName ?? ""}:${schema ?? ""}:${user?.id ?? user?.username ?? ""}`;
	const [flagVersion, setFlagVersion] = useState(0);
	const flags = useMemo(
		() => ({
			doneShown: readFlag(`gs-done:${keyBase}`),
			openedInLogin: !!user && !!openedInLogin.get(user)?.has(keyBase),
			seen: readFlag(`gs-seen:${keyBase}`),
		}),
		// flagVersion re-reads after a write.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[keyBase, flagVersion, user],
	);

	const setFlag = useCallback(
		(name: "done" | "seen") => {
			writeFlag(`gs-${name}:${keyBase}`);
			setFlagVersion((v) => v + 1);
		},
		[keyBase],
	);

	const markSeen = useCallback(() => {
		if (user) {
			const keys = openedInLogin.get(user) ?? new Set<string>();
			keys.add(keyBase);
			openedInLogin.set(user, keys);
		}
		setFlag("seen");
	}, [keyBase, setFlag, user]);

	const steps = progress
		? GETTING_STARTED_STEPS.map((step) => ({ ...step, done: step.done(progress) }))
		: GETTING_STARTED_STEPS.map((step) => ({ ...step, done: false }));
	const doneCount = steps.filter((s) => s.done).length;
	const allDone = !!progress && doneCount === steps.length;

	// An established BU (already all done before this browser ever saw the checklist) never
	// shows it; "all set" is shown only to someone who worked through it here.
	const visible = eligible && !!progress && (allDone ? flags.seen && !flags.doneShown : true);

	return {
		allDone,
		autoOpen: visible && !allDone && !flags.openedInLogin,
		doneCount,
		markDoneShown: () => setFlag("done"),
		markSeen,
		nextStep: steps.find((s) => !s.done) ?? null,
		refetch,
		steps,
		visible,
	};
};
