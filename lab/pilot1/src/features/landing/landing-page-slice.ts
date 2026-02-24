import { createSlice } from "@reduxjs/toolkit";
import type { RootStateType } from "@/store";

type LandingPageStateType = {
    isAuthenticated: boolean;
};

const initialState: LandingPageStateType = {
    isAuthenticated: false,
};

const landingPageSlice = createSlice({
    initialState,
    name: "landingPage",
    reducers: {
        authenticate: (state) => {
            state.isAuthenticated = true;
        },
        logout: (state) => {
            state.isAuthenticated = false;
        },
    },
});

export const { authenticate, logout } = landingPageSlice.actions;

export const landingPageReducer = landingPageSlice.reducer;

export const selectIsAuthenticated = (state: RootStateType) =>
    state.landingPage.isAuthenticated;
