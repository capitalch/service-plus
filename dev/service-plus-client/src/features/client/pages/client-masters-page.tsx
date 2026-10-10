import { motion } from "framer-motion";

import { ClientLayout } from "@/features/client/components/layout/client-layout";
import { useClientSelection } from "@/features/client/components/layout/client-layout";
import { CustomerSection } from "@/features/client/components/masters/customer/customer-section";
import { ModelSection } from "@/features/client/components/masters/model/model-section";
import { PartsSection } from "@/features/client/components/masters/parts/parts-section";
import { PartLocationSection } from "@/features/client/components/masters/part-location/part-location-section";
import { ProductSection } from "@/features/client/components/masters/product/product-section";
import { LookupSection } from "@/features/client/components/shared/lookup/lookup-section";
import { SparePartWebSection } from "@/features/client/components/masters/spare-part-web/spare-part-web-section";
import { TechnicianSection } from "@/features/client/components/masters/technician/technician-section";
import { VendorSection } from "@/features/client/components/masters/vendor/vendor-section";
import { BRAND_CONFIG } from "@/features/client/config/lookup-configs";

// ─── Coming Soon ──────────────────────────────────────────────────────────────

function ComingSoon({ label }: { label: string }) {
	return (
		<motion.div
			animate={{ opacity: 1 }}
			className="flex items-center justify-center rounded-lg border border-(--cl-border) bg-(--cl-surface-2) p-20"
			initial={{ opacity: 0 }}
			transition={{ duration: 0.25 }}
		>
			<div className="text-center">
				<p className="text-sm font-semibold text-(--cl-text)">{label}</p>
				<p className="mt-2 text-xs text-(--cl-text-muted)">Coming soon.</p>
			</div>
		</motion.div>
	);
}

// ─── Inner (needs layout context) ─────────────────────────────────────────────

function MastersContent() {
	const { selected } = useClientSelection();

	if (selected === "Brand") return <LookupSection config={BRAND_CONFIG} />;
	if (selected === "Customer") return <CustomerSection />;
	if (selected === "Model") return <ModelSection />;
	if (selected === "Parts") return <PartsSection />;
	if (selected === "Part Location") return <PartLocationSection />;
	if (selected === "Product") return <ProductSection />;
	if (selected === "Spare Parts Web") return <SparePartWebSection />;
	if (selected === "Technician") return <TechnicianSection />;
	if (selected === "Vendor / Supplier") return <VendorSection />;

	return <ComingSoon label={selected || "Masters"} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const ClientMastersPage = () => (
	<ClientLayout>
		<MastersContent />
	</ClientLayout>
);
