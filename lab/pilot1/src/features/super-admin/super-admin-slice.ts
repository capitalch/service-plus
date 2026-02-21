import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import {
  dummyActivityLog,
  dummyAdminUsers,
  dummyClients,
  dummyStats,
} from "./dummy-data";
import type {
  ActivityLogItemType,
  AdminUserStatusType,
  AdminUserType,
  ClientStatusType,
  ClientType,
  StatsType,
} from "./types";

type SuperAdminStateType = {
  activityLog: ActivityLogItemType[];
  adminUsers: AdminUserType[];
  clients: ClientType[];
  stats: StatsType;
};

const initialState: SuperAdminStateType = {
  activityLog: dummyActivityLog,
  adminUsers: dummyAdminUsers,
  clients: dummyClients,
  stats: dummyStats,
};

const superAdminSlice = createSlice({
  initialState,
  name: "superAdmin",
  reducers: {
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
    updateAdminUserStatus: (
      state,
      action: PayloadAction<{ id: string; status: AdminUserStatusType }>
    ) => {
      const user = state.adminUsers.find((u) => u.id === action.payload.id);
      if (user) {
        user.status = action.payload.status;
      }
    },
    updateClientStatus: (
      state,
      action: PayloadAction<{ id: string; status: ClientStatusType }>
    ) => {
      const client = state.clients.find((c) => c.id === action.payload.id);
      if (client) {
        client.status = action.payload.status;
      }
    },
  },
});

export const {
  setActivityLog,
  setAdminUsers,
  setClients,
  setStats,
  updateAdminUserStatus,
  updateClientStatus,
} = superAdminSlice.actions;

export const superAdminReducer = superAdminSlice.reducer;

export const selectActivityLog = (state: { superAdmin: SuperAdminStateType }) =>
  state.superAdmin.activityLog;

export const selectAdminUsers = (state: { superAdmin: SuperAdminStateType }) =>
  state.superAdmin.adminUsers;

export const selectClients = (state: { superAdmin: SuperAdminStateType }) =>
  state.superAdmin.clients;

export const selectStats = (state: { superAdmin: SuperAdminStateType }) =>
  state.superAdmin.stats;
