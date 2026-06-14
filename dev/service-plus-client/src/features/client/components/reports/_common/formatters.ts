const INR = new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 0,
    style: "currency",
});

const INR_PLAIN = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

const INR_WITH_DECIMALS = new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 2,
    style: "currency",
});

export function formatDateIso(value: Date | null | string | undefined): string {
    if (!value) return "";
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
}

export function formatDateShort(value: Date | null | string | undefined): string {
    if (!value) return "";
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatInr(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(Number(value))) return "₹0";
    return INR.format(Number(value));
}

export function formatInrPrecise(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(Number(value))) return "₹0.00";
    return INR_WITH_DECIMALS.format(Number(value));
}

export function formatNumber(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(Number(value))) return "0";
    return INR_PLAIN.format(Number(value));
}
