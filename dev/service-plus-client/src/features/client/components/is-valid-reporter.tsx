import { useEffect } from "react";

export function IsValidReporter({
    isSubmitting,
    isValid,
    onStatusChange,
}: {
    isSubmitting: boolean;
    isValid: boolean;
    onStatusChange: (s: { isSubmitting: boolean; isValid: boolean }) => void;
}) {
    useEffect(() => {
        onStatusChange({ isSubmitting, isValid });
    }, [isValid, isSubmitting, onStatusChange]);
    return null;
}
