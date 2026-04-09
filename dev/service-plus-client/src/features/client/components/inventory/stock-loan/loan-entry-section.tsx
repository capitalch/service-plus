import { useCallback, useEffect, useRef, useState } from "react";
import { 
    Plus, 
    Search,
    RefreshCw,
    Trash2,
    Edit,
    HandCoins,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";

import { apolloClient } from "@/lib/apollo-client";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";

import type { StockTransactionTypeRow } from "@/features/client/types/purchase";
import type { StockLoanType } from "@/features/client/types/stock-loan";
import type { BrandOption } from "@/features/client/types/model";
import { NewLoanEntry } from "./new-loan-entry";
import type { NewLoanEntryHandle } from "./new-loan-entry";

const ITEMS_PER_PAGE = 10;

export const LoanEntrySection = () => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);
    const branchId = currentBranch?.id ?? null;

    const [viewMode, setViewMode] = useState<"LIST" | "NEW" | "EDIT">("LIST");
    const [loans, setLoans] = useState<StockLoanType[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [txnTypes, setTxnTypes] = useState<StockTransactionTypeRow[]>([]);
    const [brands, setBrands] = useState<BrandOption[]>([]);
    const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);
    const [selectedLoan, setSelectedLoan] = useState<StockLoanType | null>(null);

    // Filters
    const [search, setSearch] = useState("");
    const [fromDate, setFromDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().slice(0, 10);
    });
    const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [currentPage, setCurrentPage] = useState(1);

    const formRef = useRef<NewLoanEntryHandle>(null);

    const fetchMetadata = useCallback(async () => {
        if (!dbName || !schema) return;
        try {
            const [txnRes, brandRes]: any = await Promise.all([
                apolloClient.query({
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema: schema,
                        value: JSON.stringify({ stock_transaction_type: {} })
                    },
                    fetchPolicy: "network-only"
                }),
                apolloClient.query({
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema: schema,
                        value: JSON.stringify({ brand: { is_active: true } })
                    },
                    fetchPolicy: "network-only"
                })
            ]);
            setTxnTypes(txnRes.data?.genericQuery || []);
            const fetchedBrands = brandRes.data?.genericQuery || [];
            setBrands(fetchedBrands);
            if (fetchedBrands.length > 0 && !selectedBrandId) {
                setSelectedBrandId(fetchedBrands[0].id);
            }
        } catch (e) {
            console.error(e);
        }
    }, [dbName, schema, selectedBrandId]);

    const fetchLoans = useCallback(async () => {
        if (!dbName || !schema || !branchId) return;
        setIsLoading(true);
        try {
            // Fetch Count
            const countRes: any = await apolloClient.query({
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema: schema,
                    value: JSON.stringify({
                        [SQL_MAP.GET_STOCK_LOANS_COUNT]: {
                            branch_id: branchId,
                            from_date: fromDate,
                            to_date: toDate,
                            search: search
                        }
                    })
                },
                fetchPolicy: "network-only"
            });
            const total = countRes.data?.genericQuery?.[0]?.total || 0;
            setTotalCount(Number(total));

            // Fetch Data
            const dataRes: any = await apolloClient.query({
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema: schema,
                    value: JSON.stringify({
                        [SQL_MAP.GET_STOCK_LOANS_PAGED]: {
                            branch_id: branchId,
                            from_date: fromDate,
                            to_date: toDate,
                            search: search,
                            limit: ITEMS_PER_PAGE,
                            offset: (currentPage - 1) * ITEMS_PER_PAGE
                        }
                    })
                },
                fetchPolicy: "network-only"
            });
            setLoans(dataRes.data?.genericQuery || []);
        } catch (error) {
            console.error("Fetch Loans Error:", error);
            toast.error("Failed to fetch loans");
        } finally {
            setIsLoading(false);
        }
    }, [dbName, schema, branchId, fromDate, toDate, search, currentPage]);

    useEffect(() => {
        if (viewMode === "LIST") {
            fetchLoans();
            if (txnTypes.length === 0) fetchMetadata();
        }
    }, [fetchLoans, fetchMetadata, viewMode, txnTypes.length]);

    const handleEdit = async (loan: StockLoanType) => {
        setIsLoading(true);
        try {
            const res: any = await apolloClient.query({
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema: schema,
                    value: JSON.stringify({
                        [SQL_MAP.GET_STOCK_LOAN_DETAIL]: { id: loan.id }
                    })
                }
            });
            if (res.data?.genericQuery?.[0]) {
                const loanData = res.data.genericQuery[0];
                setSelectedLoan(loanData);
                // Attempt to pick valid brand from first line if exists
                if (loanData.lines?.length > 0) {
                   // setSelectedBrandId(loanData.lines[0].brand_id); // If brand_id is in details
                }
                setViewMode("EDIT");
            }
        } catch (e) {
            toast.error("Failed to fetch loan details");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this loan record? Index stock will be reversed.")) return;
        try {
            const variables = {
                db_name: dbName,
                schema: schema,
                value: JSON.stringify({
                    stock_loan: {
                        id,
                        is_deleted: true
                    }
                })
            };
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables
            });
            toast.success("Loan record deleted");
            fetchLoans();
        } catch (e) {
            toast.error("Failed to delete loan");
        }
    };

    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

    return (
        <div className="flex h-full flex-col space-y-4 p-4 overflow-hidden text-[var(--cl-text)]">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-orange-500/10 p-2.5 shadow-sm ring-1 ring-orange-500/20">
                        <HandCoins className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight">
                            Parts Loan Entry
                        </h1>
                        <p className="text-sm font-medium text-[var(--cl-text-muted)]">
                            Track part loans given to or received from technicians and agencies
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Brand Selector for NEW/EDIT */}
                    {viewMode !== "LIST" && (
                        <div className="flex items-center gap-2 mr-4">
                            <Label className="text-[10px] font-black uppercase text-[var(--cl-text-muted)]">Brand:</Label>
                            <Select
                                value={selectedBrandId?.toString()}
                                onValueChange={(val) => setSelectedBrandId(Number(val))}
                            >
                                <SelectTrigger className="w-40 h-9 bg-[var(--cl-surface)] border-[var(--cl-border)]">
                                    <SelectValue placeholder="Select Brand" />
                                </SelectTrigger>
                                <SelectContent>
                                    {brands.map(b => (
                                        <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {viewMode === "LIST" ? (
                        <Button 
                            onClick={() => { setSelectedLoan(null); setViewMode("NEW"); }}
                            className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-lg border-b-4 border-orange-800 active:border-b-0 active:translate-y-1 transition-all"
                        >
                            <Plus className="mr-2 h-4 w-4" /> New Loan Entry
                        </Button>
                    ) : (
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setViewMode("LIST")} className="rounded-xl">
                                Cancel
                            </Button>
                            <Button 
                                onClick={() => formRef.current?.submit()} 
                                disabled={formRef.current?.isSubmitting}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg border-b-4 border-emerald-800 active:border-b-0 active:translate-y-1 transition-all"
                            >
                                {formRef.current?.isSubmitting ? "Saving..." : (viewMode === "NEW" ? "Create Loan" : "Update Loan")}
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {viewMode === "LIST" && (
                <>
                    {/* Filters */}
                    <Card className="border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-md shrink-0">
                        <CardContent className="p-3">
                            <div className="flex flex-wrap items-end gap-4">
                                <div className="space-y-1.5 min-w-[200px] flex-1">
                                    <Label className="text-[10px] font-black uppercase text-[var(--cl-text-muted)]">Search</Label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                        <Input
                                            placeholder="Technician, Ref #..."
                                            className="h-9 pl-9 bg-zinc-500/5 border-zinc-500/10"
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-[var(--cl-text-muted)]">From Date</Label>
                                    <Input
                                        type="date"
                                        className="h-9 w-40 bg-zinc-500/5"
                                        value={fromDate}
                                        onChange={e => setFromDate(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-[var(--cl-text-muted)]">To Date</Label>
                                    <Input
                                        type="date"
                                        className="h-9 w-40 bg-zinc-500/5"
                                        value={toDate}
                                        onChange={e => setToDate(e.target.value)}
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <Button variant="outline" size="icon" onClick={() => { setCurrentPage(1); fetchLoans(); }} className="h-9 w-9 rounded-lg">
                                        <Search className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="icon" onClick={() => fetchLoans()} className="h-9 w-9 rounded-lg">
                                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Table */}
                    <div className="relative flex-1 rounded-2xl border border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-lg overflow-hidden font-sans">
                        <div className="h-full overflow-auto">
                            <table className="w-full border-collapse">
                                <thead className="sticky top-0 z-10">
                                    <tr className="bg-zinc-100/90 dark:bg-zinc-900/90 backdrop-blur-sm border-b border-[var(--cl-border)]">
                                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-[var(--cl-text-muted)]">Date</th>
                                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-[var(--cl-text-muted)]">Loan To / Tech</th>
                                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-[var(--cl-text-muted)]">Ref #</th>
                                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-[var(--cl-text-muted)]">Remarks</th>
                                        <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-[var(--cl-text-muted)]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence mode="popLayout">
                                        {loans.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-20 text-center text-[var(--cl-text-muted)]">
                                                    {isLoading ? "Loading loans..." : "No loan records found"}
                                                </td>
                                            </tr>
                                        ) : (
                                            loans.map(loan => (
                                                <motion.tr
                                                    key={loan.id}
                                                    layout
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    className="group border-b border-[var(--cl-border)] hover:bg-zinc-500/5 transition-colors"
                                                >
                                                    <td className="px-4 py-3 text-sm font-medium font-mono text-zinc-600 dark:text-zinc-400">
                                                        {new Date(loan.loan_date).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-4 py-3 font-semibold text-[var(--cl-text)] hover:text-orange-600 transition-colors">
                                                        {loan.loan_to}
                                                    </td>
                                                    <td className="px-4 py-3 font-mono">
                                                        {loan.ref_no ? <Badge variant="secondary" className="bg-zinc-500/10">{loan.ref_no}</Badge> : "-"}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-[var(--cl-text-muted)] max-w-xs truncate">
                                                        {loan.remarks}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex justify-end gap-1.5">
                                                            <Button
                                                                variant="outline"
                                                                size="icon"
                                                                className="h-8 w-8 rounded-lg hover:border-blue-500 hover:text-blue-600 shrink-0"
                                                                onClick={() => handleEdit(loan)}
                                                            >
                                                                <Edit className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="icon"
                                                                className="h-8 w-8 rounded-lg hover:border-red-500 hover:text-red-600 shrink-0"
                                                                onClick={() => handleDelete(loan.id)}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            ))
                                        )}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between px-2 shrink-0 bg-zinc-100/50 dark:bg-zinc-900/50 p-3 rounded-xl border border-[var(--cl-border)]">
                        <div className="text-[10px] font-black text-[var(--cl-text-muted)] uppercase tracking-wider">
                            Total Records: {totalCount}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage === 1 || isLoading}
                                onClick={() => setCurrentPage(p => p - 1)}
                                className="h-8 w-8 p-0 rounded-lg shadow-sm"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-xs font-black min-w-24 text-center px-3 py-1 bg-[var(--cl-surface)] rounded-lg shadow-inner ring-1 ring-zinc-500/10">
                                {currentPage} / {totalPages || 1}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage >= totalPages || isLoading}
                                onClick={() => setCurrentPage(p => p + 1)}
                                className="h-8 w-8 p-0 rounded-lg shadow-sm"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </>
            )}

            {viewMode !== "LIST" && (
                <div className="flex-1 overflow-auto pr-2">
                    <NewLoanEntry
                        ref={formRef}
                        branchId={branchId}
                        txnTypes={txnTypes}
                        selectedBrandId={selectedBrandId}
                        brandName={brands.find(b => b.id === selectedBrandId)?.name}
                        editLoan={selectedLoan}
                        onSuccess={() => { setViewMode("LIST"); fetchLoans(); }}
                        onStatusChange={() => {}} 
                    />
                </div>
            )}
        </div>
    );
};
