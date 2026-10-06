import { z } from "zod";

import { MESSAGES } from "@/constants/messages";

// Same limit as the server helper and the table's CHECK (plans/plan.md, constraint 10).
export const INTERNAL_NOTE_MAX = 2000;

export const internalNoteSchema = z.object({
	note: z
		.string()
		.trim()
		.min(1, MESSAGES.ERROR_INTERNAL_NOTE_REQUIRED)
		.max(INTERNAL_NOTE_MAX, MESSAGES.ERROR_INTERNAL_NOTE_TOO_LONG),
});

export type InternalNoteFormType = z.infer<typeof internalNoteSchema>;
