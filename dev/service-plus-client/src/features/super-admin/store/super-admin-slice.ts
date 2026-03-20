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
        addAdminUser: (state, action: PayloadAction<Omit<AdminUserType, "id" | "created_at" | "updated_at" | "last_login_at">>) => {
            const newId = Math.max(0, ...state.adminUsers.map((u) => u.id)) + 1;
            const now = new Date().toISOString();
            const buName = state.clients.find((c) => c.id === action.payload.bu_id)?.name ?? "";
            state.adminUsers.push({
                ...action.payload,
                bu_name: buName,
                created_at: now,
                id: newId,
                last_login_at: now,
                updated_at: now,
            });
            state.stats.totalAdminUsers += 1;
            if (action.payload.is_active) state.stats.activeAdminUsers += 1;
            else state.stats.inactiveAdminUsers += 1;
        },
        addClient: (state, action: PayloadAction<Pick<ClientType, "code" | "is_active" | "name">>) => {
            const newId = Math.max(0, ...state.clients.map((c) => c.id)) + 1;
            const now = new Date().toISOString();
            state.clients.push({
                ...action.payload,
                activeAdminCount:  0,
                activeBuCount:     0,
                address_line1:     null,
                address_line2:     null,
                admins:            [],
                city:              null,
                country_code:      null,
                created_at:        now,
                db_name:           null,
                db_name_valid:     false,
                email:             null,
                gstin:             null,
                id:                newId,
                inactiveAdminCount: 0,
                inactiveBuCount:   0,
                pan:               null,
                phone:             null,
                pincode:           null,
                state:             null,
                updated_at:        now,
            });
            state.stats.totalBu += 1;
            state.stats.totalClients += 1;
            if (action.payload.is_active) {
                state.stats.activeBu += 1;
                state.stats.activeClients += 1;
            } else {
                state.stats.inactiveBu += 1;
                state.stats.inactiveClients += 1;
            }
        },
        setActivityLog: (state, action: PayloadAction<ActivityLogItemType[]>) => {
            state.activityLog = action.payload;
        },
        setAdminUsers: (state, action: PayloadAction<AdminUserType[]>) => {
            state.adminUsers = action.payload;
        },
        setClients: (state, action: PayloadAction<ClientType[]>) => {
            state.clients = action.payload;
        },
        setStats: (state, action: PayloadAction<StatsType>) => {
            state.stats = action.payload;
        },
        toggleAdminUserActive: (
            state,
            action: PayloadAction<{ id: number; is_active: boolean }>
        ) => {
            const user = state.adminUsers.find((u) => u.id === action.payload.id);
            if (user) {
                user.is_active = action.payload.is_active;
            }
        },
        toggleClientActive: (
            state,
            action: PayloadAction<{ id: number; is_active: boolean }>
        ) => {
            const client = state.clients.find((c) => c.id === action.payload.id);
            if (client) {
                client.is_active = action.payload.is_active;
            }
        },
    },
});

export const {
    addAdminUser,
    addClient,
    setActivityLog,
    setAdminUsers,
    setClients,
    setStats,
    toggleAdminUserActive,
    toggleClientActive,
} = superAdminSlice.actions;

export const superAdminReducer = superAdminSlice.reducer;

export const selectActivityLog = (state: RootState) => state.superAdmin.activityLog;
export const selectAdminUsers  = (state: RootState) => state.superAdmin.adminUsers;
export const selectClients     = (state: RootState) => state.superAdmin.clients;
export const selectStats       = (state: RootState) => state.superAdmin.stats;
