import { ClientLayout } from "../components/client-layout";

export const ClientConfigurationsPage = () => (
    <ClientLayout>
<div className="flex items-center justify-center rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)] p-20">
            <div className="text-center">
                <p className="text-sm font-semibold text-[var(--cl-text)]">Configurations</p>
                <p className="mt-2 text-xs text-[var(--cl-text-muted)]">System-level configuration features coming soon.</p>
            </div>
        </div>
    </ClientLayout>
);
