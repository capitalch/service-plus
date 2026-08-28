import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import type { RootState } from "@/store/index";

import type {
    ActivityLogItemType,
    AdminUserType,
    ClientType,
    StatsType,
} from "@/features/super-admin/types";

type SuperAdminStateType = {
    activityLog: ActivityLogItemType[];
    adminUsers: AdminUserType[];
    clients: ClientType[];
    stats: StatsType;
};

const initialState: SuperAdminStateType = {
    activityLog: [],
    adminUsers:  [],
    clients:     [],
    stats: {
        activeAdminUsers:   0,
        activeBu:           0,
        activeClients:      0,
        activeUsers:        0,
        inactiveAdminUsers: 0,
        inactiveBu:         0,
        inactiveClients:    0,
        inactiveUsers:      0,
        totalAdminUsers:    0,
        totalBu:            0,
        totalClients:       0,
        totalUsers:         0,
    },
};

const superAdminSlice = createSlice({
    initialState,
    name: "superAdmin",
    reducers: {
        setClients: (state, action: PayloadAction<ClientType[]>) => {
            state.clients = action.payload;
        },
        setStats: (state, action: PayloadAction<StatsType>) => {
            state.stats = action.payload;
        },
    },
});

export const {
    setClients,
    setStats,
} = superAdminSlice.actions;

export const superAdminReducer = superAdminSlice.reducer;

export const selectClients     = (state: RootState) => state.superAdmin.clients;
export const selectStats       = (state: RootState) => state.superAdmin.stats;
