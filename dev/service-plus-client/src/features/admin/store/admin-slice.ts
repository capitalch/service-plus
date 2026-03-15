import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { AdminDashboardStatsType, BusinessUnitType, BusinessUserType, RoleType } from '@/features/admin/types/index';

type AdminStateType = {
    businessUnits: BusinessUnitType[];
    businessUsers: BusinessUserType[];
    roles:         RoleType[];
    stats:         AdminDashboardStatsType;
};

const initialState: AdminStateType = {
    businessUnits: [],
    businessUsers: [],
    roles:         [],
    stats: {
        activeAdminUsers:      0,
        activeBusinessUsers:   0,
        activeBu:              0,
        auditEventsWeek:       0,
        inactiveAdminUsers:    0,
        inactiveBusinessUsers: 0,
        inactiveBu:            0,
        totalAdminUsers:       0,
        totalBusinessUsers:    0,
        totalBu:               0,
    },
};

const adminSlice = createSlice({
    initialState,
    name: 'admin',
    reducers: {
        setBusinessUnits: (state, action: PayloadAction<BusinessUnitType[]>) => {
            state.businessUnits = action.payload;
        },
        setBusinessUsers: (state, action: PayloadAction<BusinessUserType[]>) => {
            state.businessUsers = action.payload;
        },
        setRoles: (state, action: PayloadAction<RoleType[]>) => {
            state.roles = action.payload;
        },
        setStats: (state, action: PayloadAction<AdminDashboardStatsType>) => {
            state.stats = action.payload;
        },
    },
});

export const { setBusinessUnits, setBusinessUsers, setRoles, setStats } = adminSlice.actions;

export const adminReducer = adminSlice.reducer;

export const selectAdminStats     = (state: { admin: AdminStateType }) => state.admin.stats;
export const selectBusinessUnits  = (state: { admin: AdminStateType }) => state.admin.businessUnits;
export const selectBusinessUsers  = (state: { admin: AdminStateType }) => state.admin.businessUsers;
export const selectRoles          = (state: { admin: AdminStateType }) => state.admin.roles;
