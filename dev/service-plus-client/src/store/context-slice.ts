import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BranchContextType = {
    code:           string;
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
    companyName:       string | null;
    currentBranch:     BranchContextType | null;
    currentBu:         BuContextType | null;
    isGstRegistered:   boolean;
};

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: ContextStateType = {
    availableBranches: [],
    availableBus:      [],
    companyName:       null,
    currentBranch:     null,
    currentBu:         null,
    isGstRegistered:   false,
};

// ─── Slice ────────────────────────────────────────────────────────────────────

export const contextSlice = createSlice({
    name: 'context',
    initialState,
    reducers: {
        clearContext: () => initialState,

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

        setIsGstRegistered: (state, action: PayloadAction<boolean>) => {
            state.isGstRegistered = action.payload;
        },
    },
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export const {
    clearContext,
    setAvailableBranches,
    setAvailableBus,
    setCompanyName,
    setCurrentBranch,
    setCurrentBu,
    setIsGstRegistered,
} = contextSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────

type ContextRootState = { context: ContextStateType };

export const selectAvailableBranches = (state: ContextRootState) => state.context.availableBranches;
export const selectAvailableBus      = (state: ContextRootState) => state.context.availableBus;
export const selectCompanyName       = (state: ContextRootState) => state.context.companyName;
export const selectCurrentBranch     = (state: ContextRootState) => state.context.currentBranch;
export const selectCurrentBu         = (state: ContextRootState) => state.context.currentBu;
export const selectIsGstRegistered   = (state: ContextRootState) => state.context.isGstRegistered;
export const selectSchema            = (state: ContextRootState): string | null =>
    state.context.currentBu?.code?.toLowerCase() ?? null;

// ─── Reducer ──────────────────────────────────────────────────────────────────

export const contextReducer = contextSlice.reducer;
