/**
 * Centralizes auth-data persistence so "Remember me" can route reads/writes
 * to localStorage (survives browser restart) or sessionStorage (cleared when
 * the browser/tab closes) without every caller duplicating that choice.
 */

const AUTH_KEYS = ['accessToken', 'refreshToken', 'user', 'selectedClientId', 'sessionMode', 'clientCode'] as const;

const REMEMBER_FLAG_KEY = 'rememberMe';

export function setRememberFlag(remember: boolean): void {
    localStorage.setItem(REMEMBER_FLAG_KEY, String(remember));
}

export function isRemembered(): boolean {
    return localStorage.getItem(REMEMBER_FLAG_KEY) === 'true';
}

export function getAuthItem(key: string): string | null {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
}

export function setAuthItem(key: string, value: string): void {
    const activeStore  = isRemembered() ? localStorage : sessionStorage;
    const inactiveStore = isRemembered() ? sessionStorage : localStorage;
    activeStore.setItem(key, value);
    inactiveStore.removeItem(key);
}

export function clearAuthStorage(): void {
    for (const key of AUTH_KEYS) {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
    }
    localStorage.removeItem(REMEMBER_FLAG_KEY);
}
