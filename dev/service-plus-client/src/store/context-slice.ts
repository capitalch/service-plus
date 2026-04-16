import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

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
    availableBranches: BranchContextType[];
    availableBus:      BuContextType[];
    buGstStateCode:    string | null;
    buGstin:           string | null;
    companyName:       string | null;
    currentBranch:     BranchContextType | null;
    currentBu:         BuContextType | null;
    defaultGstRate:    number;
    isGstRegistered:   boolean;
};

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: ContextStateType = {
    availableBranches: [],
    availableBus:      [],
    buGstStateCode:    null,
    buGstin:           null,
    companyName:       null,
    currentBranch:     null,
    currentBu:         null,
    defaultGstRate:    0,
    isGstRegistered:   false,
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

        setIsGstRegistered: (state, action: PayloadAction<boolean>) => {
            state.isGstRegistered = action.payload;
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
    setCompanyName,
    setCurrentBranch,
    setCurrentBu,
    setDefaultGstRate,
    setIsGstRegistered,
} = contextSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────

type ContextRootState = { context: ContextStateType };

export const selectAvailableBranches     = (state: ContextRootState) => state.context.availableBranches;
export const selectAvailableBus          = (state: ContextRootState) => state.context.availableBus;
export const selectBuGstStateCode        = (state: ContextRootState) => state.context.buGstStateCode;
export const selectBuGstin               = (state: ContextRootState) => state.context.buGstin;
export const selectCompanyName           = (state: ContextRootState) => state.context.companyName;
export const selectCurrentBranch         = (state: ContextRootState) => state.context.currentBranch;
export const selectCurrentBu             = (state: ContextRootState) => state.context.currentBu;
export const selectDefaultGstRate        = (state: ContextRootState) => state.context.defaultGstRate;
export const selectIsGstRegistered       = (state: ContextRootState) => state.context.isGstRegistered;
export const selectSchema                = (state: ContextRootState): string | null =>
    state.context.currentBu?.code?.toLowerCase() ?? null;
export const selectEffectiveGstStateCode = (state: ContextRootState): string | null =>
    state.context.currentBranch?.gst_state_code ?? state.context.buGstStateCode ?? null;

// ─── Reducer ──────────────────────────────────────────────────────────────────

export const contextReducer = contextSlice.reducer;
