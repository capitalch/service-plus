import { useCallback, useState } from "react";

const STORAGE_KEY = "help-recently-viewed";
const MAX_ITEMS = 5;

function load(): string[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function save(ids: string[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function useRecentlyViewed(max = MAX_ITEMS) {
    const [ids, setIds] = useState<string[]>(load);

    const push = useCallback((articleId: string) => {
        setIds(prev => {
            const next = [articleId, ...prev.filter(id => id !== articleId)].slice(0, max);
            save(next);
            return next;
        });
    }, [max]);

    return { ids, push };
}
