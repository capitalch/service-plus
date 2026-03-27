import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    MoreHorizontalIcon,
    PencilIcon,
    PlusIcon,
    RefreshCwIcon,
    ToggleLeftIcon,
    ToggleRightIcon,
    Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import { AddCustomerDialog } from "@/features/client/components/add-customer-dialog";
import { DeleteCustomerDialog } from "@/features/client/components/delete-customer-dialog";
import { EditCustomerDialog } from "@/features/client/components/edit-customer-dialog";
import type { CustomerType, CustomerTypeOption, StateOption } from "@/features/client/types/customer";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryDataType<T> = { genericQuery: T[] | null };

// ─── Constants ────────────────────────────────────────────────────────────────

const rowVariants = {
    hidden:  { opacity: 0, y: 6 },
    visible: (i: number) => ({
        opacity:    1,
        transition: { delay: i * 0.04, duration: 0.22, ease: "easeOut" as const },
        y:          0,
    }),
};

// ─── Component ────────────────────────────────────────────────────────────────

export const CustomerSection = () => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [addOpen,         setAddOpen]         = useState(false);
    const [customers,       setCustomers]       = useState<CustomerType[]>([]);
    const [customerTypes,   setCustomerTypes]   = useState<CustomerTypeOption[]>([]);
    const [deleteCustomer,  setDeleteCustomer]  = useState<CustomerType | null>(null);
    const [editCustomer,    setEditCustomer]    = useState<CustomerType | null>(null);
    const [loading,         setLoading]         = useState(false);
    const [states,          setStates]          = useState<StateOption[]>([]);

    const loadData = useCallback(async () => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const [customersRes, typesRes, statesRes] = await Promise.all([
                apolloClient.query<GenericQueryDataType<CustomerType>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_CUSTOMERS }),
                    },
                }),
                apolloClient.query<GenericQueryDataType<CustomerTypeOption>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_CUSTOMER_TYPES }),
                    },
                }),
                apolloClient.query<GenericQueryDataType<StateOption>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_STATES }),
                    },
                }),
            ]);
            setCustomers(customersRes.data?.genericQuery ?? []);
            setCustomerTypes(typesRes.data?.genericQuery ?? []);
            setStates(statesRes.data?.genericQuery ?? []);
        } catch {
            toast.error(MESSAGES.ERROR_CUSTOMER_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    async function handleToggleActive(customer: CustomerType) {
        if (!dbName || !schema) return;
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "customer_contact",
                        xData: { id: customer.id, is_active: !customer.is_active },
                    }),
                },
            });
            await loadData();
        } catch {
            toast.error(MESSAGES.ERROR_CUSTOMER_UPDATE_FAILED);
        }
    }

    if (!schema) {
        return (
            <div className="flex items-center justify-center rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)] p-20">
                <div className="text-center">
                    <p className="text-sm font-semibold text-[var(--cl-text)]">No Business Unit</p>
                    <p className="mt-2 text-xs text-[var(--cl-text-muted)]">
                        No business unit is assigned. Please contact your administrator.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <>
            <motion.div
                animate={{ opacity: 1 }}
                className="flex flex-col gap-6"
                initial={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
            >
                {/* Page header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-[var(--cl-text)]">Customers</h1>
                        <p className="mt-1 text-sm text-[var(--cl-text-muted)]">
                            Manage customers for this business unit.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            className="gap-1.5 border border-[var(--cl-border)] bg-[var(--cl-surface-2)] text-[var(--cl-text-muted)] shadow-sm hover:bg-[var(--cl-surface-3)]"
                            disabled={loading}
                            size="sm"
                            variant="outline"
                            onClick={loadData}
                        >
                            <RefreshCwIcon className="h-3.5 w-3.5" />
                            Refresh
                        </Button>
                        <Button
                            className="bg-teal-600 text-white hover:bg-teal-700"
                            size="sm"
                            onClick={() => setAddOpen(true)}
                        >
                            <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
                            Add Customer
                        </Button>
                    </div>
                </div>

                {/* Table */}
                {loading && customers.length === 0 ? (
                    <div className="flex flex-col gap-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--cl-surface-2)]" />
                        ))}
                    </div>
                ) : customers.length === 0 ? (
                    <div className="rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)] px-6 py-12 text-center text-sm text-[var(--cl-text-muted)]">
                        No customers found. Click &quot;Add Customer&quot; to create one.
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)] shadow-sm">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-[var(--cl-surface-3)] hover:bg-[var(--cl-surface-3)]">
                                        <TableHead className="w-8 text-center text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">#</TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">Name</TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">Mobile</TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">Type</TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">State</TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">City</TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">Status</TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {customers.map((customer, idx) => (
                                        <motion.tr
                                            animate="visible"
                                            className="border-b border-[var(--cl-border)] transition-colors last:border-b-0 hover:bg-[var(--cl-surface-3)]"
                                            custom={idx}
                                            initial="hidden"
                                            key={customer.id}
                                            variants={rowVariants}
                                        >
                                            <TableCell className="text-center text-xs text-[var(--cl-text-muted)]">{idx + 1}</TableCell>
                                            <TableCell className="font-medium text-[var(--cl-text)]">
                                                {customer.full_name ?? <span className="text-[var(--cl-text-muted)]">—</span>}
                                            </TableCell>
                                            <TableCell className="font-mono text-sm text-[var(--cl-text)]">{customer.mobile}</TableCell>
                                            <TableCell className="text-sm text-[var(--cl-text-muted)]">{customer.customer_type_name ?? "—"}</TableCell>
                                            <TableCell className="text-sm text-[var(--cl-text-muted)]">{customer.state_name ?? "—"}</TableCell>
                                            <TableCell className="text-sm text-[var(--cl-text-muted)]">{customer.city ?? "—"}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    className={customer.is_active
                                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                                                        : "border-red-200 bg-red-100 text-red-500 hover:bg-red-100"}
                                                    variant="outline"
                                                >
                                                    <span className={`mr-1 h-1.5 w-1.5 rounded-full ${customer.is_active ? "bg-emerald-500" : "bg-red-400"}`} />
                                                    {customer.is_active ? "Active" : "Inactive"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            className="h-7 w-7 cursor-pointer text-[var(--cl-text-muted)] hover:text-[var(--cl-text)]"
                                                            size="icon"
                                                            variant="ghost"
                                                        >
                                                            <MoreHorizontalIcon className="h-4 w-4" />
                                                            <span className="sr-only">Actions</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-44">
                                                        <DropdownMenuItem
                                                            className="cursor-pointer text-sky-600 focus:text-sky-600"
                                                            onClick={() => setEditCustomer(customer)}
                                                        >
                                                            <PencilIcon className="mr-1.5 h-3.5 w-3.5" />
                                                            Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        {customer.is_active ? (
                                                            <DropdownMenuItem
                                                                className="cursor-pointer text-amber-600 focus:text-amber-600"
                                                                onClick={() => handleToggleActive(customer)}
                                                            >
                                                                <ToggleLeftIcon className="mr-1.5 h-3.5 w-3.5" />
                                                                Deactivate
                                                            </DropdownMenuItem>
                                                        ) : (
                                                            <DropdownMenuItem
                                                                className="cursor-pointer text-emerald-600 focus:text-emerald-600"
                                                                onClick={() => handleToggleActive(customer)}
                                                            >
                                                                <ToggleRightIcon className="mr-1.5 h-3.5 w-3.5" />
                                                                Activate
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="cursor-pointer text-red-600 focus:text-red-600"
                                                            onClick={() => setDeleteCustomer(customer)}
                                                        >
                                                            <Trash2Icon className="mr-1.5 h-3.5 w-3.5" />
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </motion.tr>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </motion.div>

            {/* ── Dialogs ──────────────────────────────────────────────────────── */}
            <AddCustomerDialog
                customerTypes={customerTypes}
                open={addOpen}
                states={states}
                onOpenChange={setAddOpen}
                onSuccess={loadData}
            />
            {editCustomer && (
                <EditCustomerDialog
                    customer={editCustomer}
                    customerTypes={customerTypes}
                    open={!!editCustomer}
                    states={states}
                    onOpenChange={(o) => { if (!o) setEditCustomer(null); }}
                    onSuccess={loadData}
                />
            )}
            {deleteCustomer && (
                <DeleteCustomerDialog
                    customer={deleteCustomer}
                    open={!!deleteCustomer}
                    onOpenChange={(o) => { if (!o) setDeleteCustomer(null); }}
                    onSuccess={loadData}
                />
            )}
        </>
    );
};
