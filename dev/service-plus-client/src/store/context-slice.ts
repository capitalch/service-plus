import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { DivisionContextType } from '../features/client/types/division';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BranchContextType = {
    code:           string;
    gst_state_code: string | null;
    gstin:          string | null;
    id:             number;
    is_active:      boolean;
    is_head_office: boolean;
    name:           string;
};

export type BuContextType = {
    code:          string;
    id:            number;
    is_active:     boolean;
    name:          string;
    schema_exists: boolean;
};

type ContextStateType = {
    availableBranches:        BranchContextType[];
    availableBus:             BuContextType[];
    availableDivisions:       DivisionContextType[];
    buGstStateCode:           string | null;
    buGstin:                  string | null;
    companyName:              string | null;
    currentBranch:            BranchContextType | null;
    currentBu:                BuContextType | null;
    currentDivision:          DivisionContextType | null;
    defaultDivisionId:        number;
    defaultGstRate:           number;
    markupPercentOverCost:    number;
    noOfJobInvoicesPerPrint:  number;
    noOfJobSheetsPerPrint:    number;
    defaultHsnForSparePart:      string;
    defaultHsnForServiceCharge:  string;
    isGstRegistered:          boolean;
    postDataToAccounts:       boolean;
};

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: ContextStateType = {
    availableBranches:        [],
    availableBus:             [],
    availableDivisions:       [],
    buGstStateCode:           null,
    buGstin:                  null,
    companyName:              null,
    currentBranch:            null,
    currentBu:                null,
    currentDivision:          null,
    defaultDivisionId:        1,
    defaultGstRate:           0,
    markupPercentOverCost:    20,
    noOfJobInvoicesPerPrint:  1,
    noOfJobSheetsPerPrint:    1,
    defaultHsnForSparePart:     "",
    defaultHsnForServiceCharge: "",
    isGstRegistered:          false,
    postDataToAccounts:       false,
};

// ─── Slice ────────────────────────────────────────────────────────────────────

export const contextSlice = createSlice({
    name: 'context',
    initialState,
    reducers: {
        clearContext: () => initialState,

        setBuGstStateCode: (state, action: PayloadAction<string | null>) => {
            state.buGstStateCode = action.payload;
        },

        setBuGstin: (state, action: PayloadAction<string | null>) => {
            state.buGstin = action.payload;
        },

        setAvailableBranches: (state, action: PayloadAction<BranchContextType[]>) => {
            state.availableBranches = action.payload;
        },

        setAvailableBus: (state, action: PayloadAction<BuContextType[]>) => {
            state.availableBus = action.payload;
        },

        setCompanyName: (state, action: PayloadAction<string | null>) => {
            state.companyName = action.payload;
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

        setMarkupPercentOverCost: (state, action: PayloadAction<number>) => {
            state.markupPercentOverCost = action.payload;
        },

        setNoOfJobInvoicesPerPrint: (state, action: PayloadAction<number>) => {
            state.noOfJobInvoicesPerPrint = action.payload;
        },

        setNoOfJobSheetsPerPrint: (state, action: PayloadAction<number>) => {
            state.noOfJobSheetsPerPrint = action.payload;
        },

        setDefaultHsnForSparePart: (state, action: PayloadAction<string>) => {
            state.defaultHsnForSparePart = action.payload;
        },

        setDefaultHsnForServiceCharge: (state, action: PayloadAction<string>) => {
            state.defaultHsnForServiceCharge = action.payload;
        },

        setIsGstRegistered: (state, action: PayloadAction<boolean>) => {
            state.isGstRegistered = action.payload;
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
    },
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export const {
    clearContext,
    setBuGstStateCode,
    setBuGstin,
    setAvailableBranches,
    setAvailableBus,
    setAvailableDivisions,
    setCompanyName,
    setCurrentBranch,
    setCurrentBu,
    setCurrentDivision,
    setDefaultDivisionId,
    setDefaultGstRate,
    setMarkupPercentOverCost,
    setDefaultHsnForSparePart,
    setNoOfJobInvoicesPerPrint,
    setNoOfJobSheetsPerPrint,
    setDefaultHsnForServiceCharge,
    setIsGstRegistered,
    setPostDataToAccounts,
} = contextSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────

type ContextRootState = { context: ContextStateType };

export const selectAvailableBranches     = (state: ContextRootState) => state.context.availableBranches;
export const selectAvailableBus          = (state: ContextRootState) => state.context.availableBus;
export const selectAvailableDivisions    = (state: ContextRootState) => state.context.availableDivisions;
export const selectBuGstStateCode        = (state: ContextRootState) => state.context.buGstStateCode;
export const selectBuGstin               = (state: ContextRootState) => state.context.buGstin;
export const selectCompanyName           = (state: ContextRootState) => state.context.companyName;
export const selectCurrentBranch         = (state: ContextRootState) => state.context.currentBranch;
export const selectCurrentBu             = (state: ContextRootState) => state.context.currentBu;
export const selectCurrentDivision       = (state: ContextRootState) => state.context.currentDivision;
export const selectDefaultDivisionId     = (state: ContextRootState) => state.context.defaultDivisionId;
export const selectDefaultGstRate           = (state: ContextRootState) => state.context.defaultGstRate;
export const selectMarkupPercentOverCost    = (state: ContextRootState) => state.context.markupPercentOverCost;
export const selectNoOfJobInvoicesPerPrint  = (state: ContextRootState) => state.context.noOfJobInvoicesPerPrint;
export const selectNoOfJobSheetsPerPrint    = (state: ContextRootState) => state.context.noOfJobSheetsPerPrint;
export const selectDefaultHsnForSparePart      = (state: ContextRootState) => state.context.defaultHsnForSparePart;
export const selectDefaultHsnForServiceCharge  = (state: ContextRootState) => state.context.defaultHsnForServiceCharge;
export const selectIsGstRegistered          = (state: ContextRootState) => state.context.isGstRegistered;
export const selectPostDataToAccounts       = (state: ContextRootState) => state.context.postDataToAccounts;
export const selectHomeStateId           = (state: ContextRootState): number | null =>
    state.context.currentDivision?.state_id ?? null;
export const selectIsGstMode             = (state: ContextRootState): boolean =>
    !!state.context.currentDivision?.gstin;
export const selectSchema                = (state: ContextRootState): string | null =>
    state.context.currentBu?.code?.toLowerCase() ?? null;
export const selectEffectiveGstStateCode = (state: ContextRootState): string | null =>
    state.context.currentBranch?.gst_state_code ?? state.context.buGstStateCode ?? null;

// ─── Reducer ──────────────────────────────────────────────────────────────────

export const contextReducer = contextSlice.reducer;
