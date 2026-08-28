/**
 * Centralizes auth-data persistence so "Remember me" can route reads/writes
 * to localStorage (survives browser restart) or sessionStorage (cleared when
 * the browser/tab closes) without every caller duplicating that choice.
 *
 * "Remember me" also stores the last login's identity (client + username, never
 * the password) so the login form can prefill it on the next visit.
 */

const AUTH_KEYS = ['accessToken', 'refreshToken', 'user', 'selectedClientId', 'sessionMode', 'clientCode', 'clientName'] as const;

const REMEMBER_FLAG_KEY = 'rememberMe';

// Deliberately NOT in AUTH_KEYS: the remembered identity must outlive logout,
// otherwise signing out would wipe the prefill that "Remember me" promises.
const LAST_LOGIN_KEY = 'lastLogin';

export type LastLoginType = {
    clientId:        string;
    clientName:      string;
    emailOrUsername: string;
    isSuperAdmin:    boolean;
}

export function setRememberFlag(remember: boolean): void {
    localStorage.setItem(REMEMBER_FLAG_KEY, String(remember));
}

/** Pass null to forget the previous identity (user unchecked "Remember me"). */
export function saveLastLogin(profile: LastLoginType | null): void {
    if (profile) {
        localStorage.setItem(LAST_LOGIN_KEY, JSON.stringify(profile));
    } else {
        localStorage.removeItem(LAST_LOGIN_KEY);
    }
}

export function getLastLogin(): LastLoginType | null {
    try {
        const raw = localStorage.getItem(LAST_LOGIN_KEY);
        if (!raw) return null;
        // Hand-edited or legacy values must not half-fill the form: accept objects only
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed !== null ? (parsed as LastLoginType) : null;
    } catch {
        return null;
    }
}

function isRemembered(): boolean {
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
