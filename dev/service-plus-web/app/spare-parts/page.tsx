"use client";

import {
  ChevronLeft,
  ChevronRight,
  Mail,
  MapPin,
  PackageSearch,
  Phone,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CompanySelect } from "@/components/shared/company-select";
import { BranchSelect } from "@/components/spare-parts/branch-select";
import { CartDrawer } from "@/components/spare-parts/cart-drawer";
import { CartFab } from "@/components/spare-parts/cart-fab";
import { CheckoutDialog } from "@/components/spare-parts/checkout-dialog";
import type { CheckoutFormValues } from "@/components/spare-parts/checkout-form";
import { PartDetailDialog } from "@/components/spare-parts/part-detail-dialog";
import { PartsGrid } from "@/components/spare-parts/parts-grid";
import { PartsSearch } from "@/components/spare-parts/parts-search";
import { fetchCompanyInfo, fetchParts, submitPartOrder } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/use-cart";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { ApiError, type Branch, type CompanyInfo, type PartOrderResult, type PartsPage } from "@/lib/types";

const PAGE_SIZE = 20;

export default function SparePartsPage() {
  const [company, setCompany] = useState("");
  const [branch, setBranch] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [page, setPage] = useState(1);

  const [partsPage, setPartsPage] = useState<PartsPage | null>(null);
  const [loadingParts, setLoadingParts] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);

  const cart = useCart(company || null, branch);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderResult, setOrderResult] = useState<PartOrderResult | null>(null);

  const [pendingBranch, setPendingBranch] = useState<string | null>(null);

  useEffect(() => {
    setSearch("");
    setPage(1);
  }, [branch]);

  useEffect(() => {
    if (!company || !branch) {
      setPartsPage(null);
      return;
    }
    setLoadingParts(true);
    fetchParts({ company, branch, search: debouncedSearch, page, pageSize: PAGE_SIZE })
      .then(setPartsPage)
      .catch(() => toast.error("Something went wrong loading parts. Please try again."))
      .finally(() => setLoadingParts(false));
  }, [company, branch, debouncedSearch, page, refreshKey]);

  useEffect(() => {
    if (!company || !branch) {
      setCompanyInfo(null);
      return;
    }
    fetchCompanyInfo({ company, branch })
      .then(setCompanyInfo)
      .catch(() => setCompanyInfo(null));
  }, [company, branch]);

  function handleBranchChange(newBranch: string | null) {
    if (branch && newBranch && newBranch !== branch && cart.lines.length > 0) {
      setPendingBranch(newBranch);
      return;
    }
    setBranch(newBranch);
  }

  async function handleCheckoutSubmit(values: CheckoutFormValues) {
    if (!company || !branch) return;
    setSubmittingOrder(true);
    try {
      const result = await submitPartOrder({
        company,
        branch,
        customerName: values.customerName,
        mobile: values.mobile,
        email: values.email || undefined,
        remarks: values.remarks || undefined,
        lines: cart.lines.map((line) => ({ partId: line.partId, qty: line.qty })),
      });
      cart.clear();
      setOrderResult(result);
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Something went wrong placing your order. Please try again.",
      );
    } finally {
      setSubmittingOrder(false);
    }
  }

  const catalogueUnavailable = !!company && branches !== null && branches.length === 0;
  const totalPages = partsPage ? Math.max(1, Math.ceil(partsPage.total / PAGE_SIZE)) : 1;
  const startIndex = (page - 1) * PAGE_SIZE;
  const shownStart = partsPage && partsPage.total > 0 ? startIndex + 1 : 0;
  const shownEnd = partsPage ? Math.min(startIndex + partsPage.items.length, partsPage.total) : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:py-12">
      <div className="mx-auto max-w-2xl text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-gradient-brand text-white shadow-md shadow-primary/25">
          <PackageSearch className="size-6" />
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          Genuine spare parts
        </h1>
        <p className="mt-3 text-muted-foreground">
          Browse the spare-parts catalogue for your nearest service center. Prices are
          indicative — our team will confirm delivery and billing once you place a request.
        </p>
      </div>

      <div className="mt-10 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
          <CompanySelect
            showPartsCount
            value={company}
            onChange={(value) => {
              setCompany(value);
              setBranch(null);
              setBranches(null);
            }}
          />
          <BranchSelect
            company={company || null}
            value={branch}
            onChange={handleBranchChange}
            onBranchesChange={setBranches}
          />
          {branch && (
            <div className="flex items-end justify-start sm:justify-end lg:justify-end">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-1.5 sm:w-auto"
                onClick={() => setCartOpen(true)}
              >
                <ShoppingCart className="size-4" />
                Cart{cart.totalQty > 0 ? ` (${cart.totalQty})` : ""}
              </Button>
            </div>
          )}
        </div>

        {companyInfo && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold text-foreground">{companyInfo.branchName}</p>
            <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
              {companyInfo.supportPhone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5 shrink-0" />
                  {companyInfo.supportPhone}
                </span>
              )}
              {companyInfo.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5 shrink-0" />
                  {companyInfo.email}
                </span>
              )}
              {companyInfo.address && (
                <span className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" />
                  {companyInfo.address}
                </span>
              )}
            </div>
          </div>
        )}

        {branch && (
          <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-4">
            <div className="flex-1">
              <PartsSearch value={search} onChange={setSearch} />
            </div>
            {partsPage && partsPage.total > 0 && (
              <p className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                Showing {shownStart}–{shownEnd} of {partsPage.total} parts
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Refresh parts"
              title="Refresh parts"
              disabled={loadingParts}
              onClick={() => setRefreshKey((k) => k + 1)}
            >
              <RefreshCw className={cn("size-4", loadingParts && "animate-spin")} />
            </Button>
          </div>
        )}
      </div>

      <div className="mt-8 pb-24">
        {!company ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <PackageSearch className="size-6" />
            </span>
            <p className="text-sm font-medium text-foreground">Select a company</p>
            <p className="text-sm text-muted-foreground">
              Choose a company above to browse its spare-parts catalogue.
            </p>
          </div>
        ) : catalogueUnavailable ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <PackageSearch className="size-6" />
            </span>
            <p className="text-sm font-medium text-foreground">Catalogue unavailable</p>
            <p className="text-sm text-muted-foreground">
              The spare-parts catalogue isn&apos;t available for this company yet.
            </p>
          </div>
        ) : !branch ? null : (
          <div className="space-y-6">
            <PartsGrid
              parts={partsPage?.items ?? []}
              loading={loadingParts}
              startIndex={startIndex}
              onSelectPart={setSelectedPartId}
              onAddToCart={cart.addLine}
            />
            {partsPage && totalPages > 1 && (
              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loadingParts}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="size-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || loadingParts}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {branch && (
        <CartFab totalQty={cart.totalQty} totalAmount={cart.totalAmount} onOpen={() => setCartOpen(true)} />
      )}

      {selectedPartId != null && company && branch && (
        <PartDetailDialog
          company={company}
          branch={branch}
          partId={selectedPartId}
          onClose={() => setSelectedPartId(null)}
        />
      )}

      <CartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        lines={cart.lines}
        totalAmount={cart.totalAmount}
        onUpdateQty={cart.updateQty}
        onRemove={cart.removeLine}
        onCheckout={() => {
          setCartOpen(false);
          setCheckoutOpen(true);
        }}
      />

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={(open) => {
          setCheckoutOpen(open);
          if (!open) setOrderResult(null);
        }}
        submitting={submittingOrder}
        onSubmit={handleCheckoutSubmit}
        orderResult={orderResult}
        branchName={companyInfo?.branchName ?? branches?.find((b) => b.code === branch)?.name ?? ""}
        supportPhone={companyInfo?.supportPhone ?? null}
      />

      <Dialog open={pendingBranch !== null} onOpenChange={(open) => !open && setPendingBranch(null)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Switch branch?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Your cart has items from the current branch. Switching branches will hide this cart
            — it stays saved and reappears if you come back to this branch.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setPendingBranch(null)}>
              Keep browsing here
            </Button>
            <Button
              type="button"
              onClick={() => {
                setBranch(pendingBranch);
                setPendingBranch(null);
              }}
            >
              Switch branch
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
