import { counterReducer } from "@/components/redux-counter/redux-counter-slice";
import { configureStore } from "@reduxjs/toolkit";
export const store = configureStore({
    reducer: {
        counter: counterReducer,
    }
});

export type RootStateType = ReturnType<typeof store.getState>;
export type AppDispatchType = typeof store.dispatch;