import { refreshAccessToken } from "@/lib/auth-service";
import { getAuthItem, setAuthItem } from "@/lib/auth-storage";

/**
 * Returns a valid access token, proactively refreshing it first when it is
 * within 5 minutes of expiry. Shared by the Apollo `authLink` (GraphQL) and
 * the REST image service so an expired token is never sent on the wire.
 *
 * Returns `null` only when there is no stored access token at all. On any
 * error (unparseable token, refresh failure) it falls back to the current
 * token so the caller still makes the request — the reactive error handlers
 * recover from a genuinely dead session.
 */
export async function refreshIfNeeded(): Promise<string | null> {
    const token = getAuthItem("accessToken");
    if (!token) return null;

    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const exp = payload.exp;
        const now = Math.floor(Date.now() / 1000);
        const timeLeft = exp - now;

        // Refresh if less than 5 minutes left
        if (timeLeft < 300) {
            const refreshToken = getAuthItem("refreshToken");
            if (!refreshToken) return token;

            const res = await refreshAccessToken(refreshToken);
            setAuthItem("accessToken", res.accessToken);
            setAuthItem("refreshToken", res.refreshToken);
            return res.accessToken;
        }
        return token;
    } catch {
        return token;
    }
}
