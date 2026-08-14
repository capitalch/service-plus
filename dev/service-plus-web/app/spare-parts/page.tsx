"use client";

import { ChevronLeft, ChevronRight, PackageSearch, ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CompanySelect } from "@/components/shared/company-select";
import { BranchSelect } from "@/components/spare-parts/branch-select";
import { CartDrawer } from "@/components/spare-parts/cart-drawer";
import { CheckoutDialog } from "@/components/spare-parts/checkout-dialog";
import type { CheckoutFormValues } from "@/components/spare-parts/checkout-form";
import { PartDetailDialog } from "@/components/spare-parts/part-detail-dialog";
import { PartsGrid } from "@/components/spare-parts/parts-grid";
import { PartsSearch } from "@/components/spare-parts/parts-search";
import { fetchCompanyInfo, fetchParts, submitPartOrder } from "@/lib/api";
import { useCart } from "@/lib/use-cart";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { ApiError, type Branch, type CompanyInfo, type PartOrderResult, type PartsPage } from "@/lib/types";

const PAGE_SIZE = 20;

export default function SparePartsPage() {
  const [company, setCompany] = useState("");
  const [branch, setBranch] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[] | null>(null); // null = not resolved yet
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [page, setPage] = useState(1);

  const [partsPage, setPartsPage] = useState<PartsPage | null>(null);
  const [loadingParts, setLoadingParts] = useState(false);

  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);

  const cart = useCart(company || null, branch);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderResult, setOrderResult] = useState<PartOrderResult | null>(null);

  // Discard-confirmation on branch switch (§9) — the cart itself is never lost (it's
  // stored per (company, branch) pair and reappears if the customer switches back);
  // this only guards against silently hiding an in-progress cart from view.
  const [pendingBranch, setPendingBranch] = useState<string | null>(null);

  // Search and page reset whenever the resolved branch changes — results are
  // branch-scoped, so a stale search/page from the previous branch never leaks in.
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
  }, [company, branch, debouncedSearch, page]);

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

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:py-16">
      <div className="mx-auto max-w-2xl text-center">
        <span className="mx-auto flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <PackageSearch className="size-5" />
        </span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Genuine spare parts
        </h1>
        <p className="mt-3 text-muted-foreground">
          Browse the spare-parts catalogue for your nearest service center. Prices are
          indicative — our team will confirm delivery and billing once you place a request.
        </p>
      </div>

      <div className="mx-auto mt-8 flex max-w-md flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <CompanySelect
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
        </div>
        {branch && (
          <Button
            type="button"
            variant="outline"
            className="ml-auto gap-1.5"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart className="size-4" />
            Cart{cart.totalQty > 0 ? ` (${cart.totalQty})` : ""}
          </Button>
        )}
      </div>

      <div className="mt-10">
        {!company ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Select a company above to browse its spare-parts catalogue.
          </div>
        ) : catalogueUnavailable ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            The spare-parts catalogue isn&apos;t available for this company yet.
          </div>
        ) : !branch ? null : (
          <div className="space-y-4">
            <PartsSearch value={search} onChange={setSearch} />
            <PartsGrid
              parts={partsPage?.items ?? []}
              loading={loadingParts}
              onSelectPart={setSelectedPartId}
              onAddToCart={cart.addLine}
            />
            {partsPage && totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
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
