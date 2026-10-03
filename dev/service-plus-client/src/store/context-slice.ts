import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { DivisionContextType } from "../features/client/types/division";
import { logout, setCredentials } from "../features/auth/store/auth-slice";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BranchContextType = {
	code: string;
	gst_state_code: string | null;
	gstin: string | null;
	id: number;
	is_active: boolean;
	is_head_office: boolean;
	name: string;
};

/** A BU's billing summary, always computed by the server (plans/plan.md Steps 11, 14). */
export type BuBillingType = {
	branchLimit: number | null;
	paidThrough: string | null;
	planCode: string | null;
	status: "active" | "due_soon" | "not_billed" | "read_only";
};

/** A write the server refused for billing reasons, shown in the read-only dialog. */
export type BillingNoticeType = {
	code: "BRANCH_LIMIT_REACHED" | "SUBSCRIPTION_READ_ONLY";
	message: string;
	paidThrough: string | null;
};

export type BuContextType = {
	/** From login; may be stale — the live status is `billing` in this slice. */
	billing?: BuBillingType;
	code: string;
	id: number;
	is_active: boolean;
	name: string;
	schema_exists: boolean;
};

type ContextStateType = {
	availableBranches: BranchContextType[];
	/** The current BU's billing, fetched with buBillingStatus; null until known. */
	billing: BuBillingType | null;
	billingNotice: BillingNoticeType | null;
	/** Bumped to ask the billing sync to re-read the status (e.g. after a blocked write). */
	billingRefreshTick: number;
	availableBus: BuContextType[];
	availableDivisions: DivisionContextType[];
	buGstStateCode: string | null;
	buGstin: string | null;
	companyName: string | null;
	currentBranch: BranchContextType | null;
	currentBu: BuContextType | null;
	currentDivision: DivisionContextType | null;
	// The current branch's default division (division.is_default); 0 until a branch with divisions is resolved.
	defaultDivisionId: number;
	defaultGstRate: number;
	// App Settings → extended_warranty.enabled (strictly true) — shows Custom → Extended
	// Warranty and gates its bell count.
	extendedWarrantyEnabled: boolean;
	markupPercentOverCost: number;
	noOfJobInvoicesPerPrint: number;
	noOfJobReceiptsPerPrint: number;
	noOfJobSheetsPerPrint: number;
	trackJobUrl: string | null;
	jobTermsAndConditions: string;
	defaultHsnForSparePart: string;
	defaultHsnForServiceCharge: string;
	isGstRegistered: boolean;
	postDataToAccounts: boolean;
	isResolvingContext: boolean;
};

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: ContextStateType = {
	availableBranches: [],
	billing: null,
	billingNotice: null,
	billingRefreshTick: 0,
	availableBus: [],
	availableDivisions: [],
	buGstStateCode: null,
	buGstin: null,
	companyName: null,
	currentBranch: null,
	currentBu: null,
	currentDivision: null,
	defaultDivisionId: 0,
	defaultGstRate: 0,
	extendedWarrantyEnabled: false,
	markupPercentOverCost: 20,
	noOfJobInvoicesPerPrint: 1,
	noOfJobReceiptsPerPrint: 1,
	noOfJobSheetsPerPrint: 1,
	trackJobUrl: null,
	jobTermsAndConditions: "",
	defaultHsnForSparePart: "",
	defaultHsnForServiceCharge: "",
	isGstRegistered: false,
	postDataToAccounts: false,
	isResolvingContext: true,
};

// ─── Slice ────────────────────────────────────────────────────────────────────

const contextSlice = createSlice({
	name: "context",
	initialState,
	reducers: {
		clearContext: () => initialState,

		clearBillingNotice: (state) => {
			state.billingNotice = null;
		},

		requestBillingRefresh: (state) => {
			state.billingRefreshTick += 1;
		},

		setBilling: (state, action: PayloadAction<BuBillingType | null>) => {
			state.billing = action.payload;
		},

		showBillingNotice: (state, action: PayloadAction<BillingNoticeType>) => {
			state.billingNotice = action.payload;
		},

		setAvailableBranches: (state, action: PayloadAction<BranchContextType[]>) => {
			state.availableBranches = action.payload;
		},

		setAvailableBus: (state, action: PayloadAction<BuContextType[]>) => {
			state.availableBus = action.payload;
		},

		setCurrentBranch: (state, action: PayloadAction<BranchContextType | null>) => {
			state.currentBranch = action.payload;
		},

		setCurrentBu: (state, action: PayloadAction<BuContextType | null>) => {
			state.currentBu = action.payload;
		},

		setDefaultGstRate: (state, action: PayloadAction<number>) => {
			state.defaultGstRate = action.payload;
		},

		setExtendedWarrantyEnabled: (state, action: PayloadAction<boolean>) => {
			state.extendedWarrantyEnabled = action.payload;
		},

		setMarkupPercentOverCost: (state, action: PayloadAction<number>) => {
			state.markupPercentOverCost = action.payload;
		},

		setNoOfJobInvoicesPerPrint: (state, action: PayloadAction<number>) => {
			state.noOfJobInvoicesPerPrint = action.payload;
		},

		setNoOfJobReceiptsPerPrint: (state, action: PayloadAction<number>) => {
			state.noOfJobReceiptsPerPrint = action.payload;
		},

		setNoOfJobSheetsPerPrint: (state, action: PayloadAction<number>) => {
			state.noOfJobSheetsPerPrint = action.payload;
		},

		setTrackJobUrl: (state, action: PayloadAction<string | null>) => {
			state.trackJobUrl = action.payload;
		},

		setJobTermsAndConditions: (state, action: PayloadAction<string>) => {
			state.jobTermsAndConditions = action.payload;
		},

		setDefaultHsnForSparePart: (state, action: PayloadAction<string>) => {
			state.defaultHsnForSparePart = action.payload;
		},

		setDefaultHsnForServiceCharge: (state, action: PayloadAction<string>) => {
			state.defaultHsnForServiceCharge = action.payload;
		},

		setAvailableDivisions: (state, action: PayloadAction<DivisionContextType[]>) => {
			state.availableDivisions = action.payload;
		},

		setCurrentDivision: (state, action: PayloadAction<DivisionContextType | null>) => {
			state.currentDivision = action.payload;
		},

		setDefaultDivisionId: (state, action: PayloadAction<number>) => {
			state.defaultDivisionId = action.payload;
		},

		setPostDataToAccounts: (state, action: PayloadAction<boolean>) => {
			state.postDataToAccounts = action.payload;
		},

		setIsResolvingContext: (state, action: PayloadAction<boolean>) => {
			state.isResolvingContext = action.payload;
		},
	},
	extraReducers: (builder) => {
		// Tenant identity can change on logout OR on a direct re-login (the
		// /login route has no guard against an already-authenticated user, so
		// login can fire without a preceding logout). Reset in both cases so
		// BuBranchSwitcher's mount guard re-resolves BU/branch/division for
		// whichever tenant is now active, instead of keeping the previous
		// tenant's stale schema.
		builder.addCase(logout, () => initialState).addCase(setCredentials, () => initialState);
	},
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export const {
	clearBillingNotice,
	clearContext,
	requestBillingRefresh,
	setBilling,
	showBillingNotice,
	setAvailableBranches,
	setAvailableBus,
	setAvailableDivisions,
	setCurrentBranch,
	setCurrentBu,
	setCurrentDivision,
	setDefaultDivisionId,
	setDefaultGstRate,
	setExtendedWarrantyEnabled,
	setMarkupPercentOverCost,
	setDefaultHsnForSparePart,
	setNoOfJobInvoicesPerPrint,
	setNoOfJobReceiptsPerPrint,
	setNoOfJobSheetsPerPrint,
	setTrackJobUrl,
	setJobTermsAndConditions,
	setDefaultHsnForServiceCharge,
	setPostDataToAccounts,
	setIsResolvingContext,
} = contextSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────

type ContextRootState = { context: ContextStateType };

export const selectAvailableBranches = (state: ContextRootState) => state.context.availableBranches;
export const selectBilling = (state: ContextRootState) => state.context.billing;
export const selectBillingNotice = (state: ContextRootState) => state.context.billingNotice;
export const selectBillingRefreshTick = (state: ContextRootState) => state.context.billingRefreshTick;
export const selectIsReadOnly = (state: ContextRootState) => state.context.billing?.status === "read_only";
export const selectAvailableBus = (state: ContextRootState) => state.context.availableBus;
export const selectAvailableDivisions = (state: ContextRootState) => state.context.availableDivisions;
export const selectCompanyName = (state: ContextRootState) => state.context.companyName;
export const selectCurrentBranch = (state: ContextRootState) => state.context.currentBranch;
export const selectCurrentBu = (state: ContextRootState) => state.context.currentBu;
export const selectCurrentDivision = (state: ContextRootState) => state.context.currentDivision;
export const selectDefaultDivisionId = (state: ContextRootState) => state.context.defaultDivisionId;
export const selectDefaultGstRate = (state: ContextRootState) => state.context.defaultGstRate;
export const selectExtendedWarrantyEnabled = (state: ContextRootState) => state.context.extendedWarrantyEnabled;
export const selectMarkupPercentOverCost = (state: ContextRootState) => state.context.markupPercentOverCost;
export const selectNoOfJobInvoicesPerPrint = (state: ContextRootState) => state.context.noOfJobInvoicesPerPrint;
export const selectNoOfJobReceiptsPerPrint = (state: ContextRootState) => state.context.noOfJobReceiptsPerPrint;
export const selectNoOfJobSheetsPerPrint = (state: ContextRootState) => state.context.noOfJobSheetsPerPrint;
export const selectTrackJobUrl = (state: ContextRootState) => state.context.trackJobUrl;
export const selectJobTermsAndConditions = (state: ContextRootState) => state.context.jobTermsAndConditions;
export const selectDefaultHsnForSparePart = (state: ContextRootState) => state.context.defaultHsnForSparePart;
export const selectDefaultHsnForServiceCharge = (state: ContextRootState) => state.context.defaultHsnForServiceCharge;
export const selectPostDataToAccounts = (state: ContextRootState) => state.context.postDataToAccounts;
export const selectHomeStateId = (state: ContextRootState): number | null =>
	state.context.currentDivision?.state_id ?? null;
export const selectIsGstMode = (state: ContextRootState): boolean => !!state.context.currentDivision?.gstin;
export const selectSchema = (state: ContextRootState): string | null =>
	state.context.currentBu?.code?.toLowerCase() ?? null;
export const selectEffectiveGstStateCode = (state: ContextRootState): string | null =>
	state.context.currentBranch?.gst_state_code ?? state.context.buGstStateCode ?? null;
export const selectIsResolvingContext = (state: ContextRootState) => state.context.isResolvingContext;
export const selectIsBuBranchDivisionComplete = (state: ContextRootState): boolean => {
	const { currentBu, currentBranch, currentDivision, availableDivisions } = state.context;
	if (!currentBu || !currentBranch) return false;
	if (availableDivisions.length === 0) return true;
	return currentDivision !== null;
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

export const contextReducer = contextSlice.reducer;
