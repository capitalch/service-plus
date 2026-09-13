import { ClientLayout, useClientSelection } from "../components/layout/client-layout";

// ─── Coming Soon placeholder ──────────────────────────────────────────────────

function ComingSoon({ label }: { label: string }) {
	return (
		<div className="flex flex-1 items-center justify-center rounded-lg border border-(--cl-border) bg-(--cl-surface-2) p-20">
			<div className="text-center">
				<p className="text-sm font-semibold text-(--cl-text)">{label}</p>
				<p className="mt-2 text-xs text-(--cl-text-muted)">This add-on is coming soon.</p>
			</div>
		</div>
	);
}

// ─── Inner (needs layout context) ─────────────────────────────────────────────

function CustomContent() {
	const { selected } = useClientSelection();
	const s = selected?.trim() || "";

	return <ComingSoon label={s || "Custom"} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const ClientCustomPage = () => (
	<ClientLayout>
		<CustomContent />
	</ClientLayout>
);
