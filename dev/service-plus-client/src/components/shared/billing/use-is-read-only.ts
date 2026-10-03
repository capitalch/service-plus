import { selectIsReadOnly } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

/** True while the current BU is view-only for an unpaid month (status from the server). */
export const useIsReadOnly = (): boolean => useAppSelector(selectIsReadOnly);
