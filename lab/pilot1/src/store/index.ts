import { counterReducer } from "@/components/redux-counter/redux-counter-slice";
import { landingPageReducer } from "@/features/landing/landing-page-slice";
import { superAdminReducer } from "@/features/super-admin/super-admin-slice";
import { configureStore } from "@reduxjs/toolkit";

export const store = configureStore({
    reducer: {
        counter: counterReducer,
        landingPage: landingPageReducer,
        superAdmin: superAdminReducer,
    }
});

export type RootStateType = ReturnType<typeof store.getState>;
export type AppDispatchType = typeof store.dispatch;