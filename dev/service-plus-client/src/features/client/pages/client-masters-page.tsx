import { ClientLayout } from "../components/client-layout";

export const ClientMastersPage = () => (
    <ClientLayout>
<div className="flex items-center justify-center rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)] p-20">
            <div className="text-center">
                <p className="text-sm font-semibold text-[var(--cl-text)]">Masters</p>
                <p className="mt-2 text-xs text-[var(--cl-text-muted)]">Master data management features coming soon.</p>
            </div>
        </div>
    </ClientLayout>
);
