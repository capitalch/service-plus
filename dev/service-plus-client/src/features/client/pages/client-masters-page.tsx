import { motion } from "framer-motion";

import { ClientLayout } from "@/features/client/components/client-layout";
import { useClientSelection } from "@/features/client/components/client-layout";
import { BranchSection } from "@/features/client/components/branch-section";
import { CustomerSection } from "@/features/client/components/customer-section";
import { FinancialYearSection } from "@/features/client/components/financial-year-section";
import { LookupSection } from "@/features/client/components/lookup-section";
import { ModelSection } from "@/features/client/components/model-section";
import { PartsSection } from "@/features/client/components/parts-section";
import { PartLocationSection } from "@/features/client/components/part-location-section";
import { ProductSection } from "@/features/client/components/product-section";
import { StateSection } from "@/features/client/components/state-section";
import { TechnicianSection } from "@/features/client/components/technician-section";
import { VendorSection } from "@/features/client/components/vendor-section";
import {
    BRAND_CONFIG,
    CUSTOMER_TYPE_CONFIG,
    DOCUMENT_TYPE_CONFIG,
    JOB_DELIVERY_MANNER_CONFIG,
    JOB_RECEIVE_CONDITION_CONFIG,
    JOB_RECEIVE_MANNER_CONFIG,
    JOB_STATUS_CONFIG,
    JOB_TYPE_CONFIG,
} from "@/features/client/config/lookup-configs";

// ─── Coming Soon ──────────────────────────────────────────────────────────────

function ComingSoon({ label }: { label: string }) {
    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex items-center justify-center rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)] p-20"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            <div className="text-center">
                <p className="text-sm font-semibold text-[var(--cl-text)]">{label}</p>
                <p className="mt-2 text-xs text-[var(--cl-text-muted)]">Coming soon.</p>
            </div>
        </motion.div>
    );
}

// ─── Inner (needs layout context) ─────────────────────────────────────────────

function MastersContent() {
    const { selected } = useClientSelection();

    if (selected === "Brand")                 return <LookupSection config={BRAND_CONFIG} />;
    if (selected === "Branch")                return <BranchSection />;
    if (selected === "Customer")              return <CustomerSection />;
    if (selected === "Customer Type")         return <LookupSection config={CUSTOMER_TYPE_CONFIG} />;
    if (selected === "Document Type")         return <LookupSection config={DOCUMENT_TYPE_CONFIG} />;
    if (selected === "Financial Year")        return <FinancialYearSection />;
    if (selected === "Job Delivery Manner")   return <LookupSection config={JOB_DELIVERY_MANNER_CONFIG} />;
    if (selected === "Job Receive Condition") return <LookupSection config={JOB_RECEIVE_CONDITION_CONFIG} />;
    if (selected === "Job Receive Manner")    return <LookupSection config={JOB_RECEIVE_MANNER_CONFIG} />;
    if (selected === "Job Status")            return <LookupSection config={JOB_STATUS_CONFIG} />;
    if (selected === "Job Type")              return <LookupSection config={JOB_TYPE_CONFIG} />;
    if (selected === "Model")                 return <ModelSection />;
    if (selected === "Parts")                 return <PartsSection />;
    if (selected === "Part Location")         return <PartLocationSection />;
    if (selected === "Product")               return <ProductSection />;
    if (selected === "State / Province")      return <StateSection />;
    if (selected === "Technician")            return <TechnicianSection />;
    if (selected === "Vendor / Supplier")     return <VendorSection />;

    return <ComingSoon label={selected || "Masters"} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const ClientMastersPage = () => (
    <ClientLayout>
        <MastersContent />
    </ClientLayout>
);
