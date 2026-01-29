import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import type { TypedUseSelectorHook } from "react-redux";
import uiReducer from "@/stores/ui.slice";
import authReducer from "@/stores/auth.slice";
import ticketReducer from "@/features/tickets/ticket.slice";
import { api } from "./api";

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    auth: authReducer,
    ticket: ticketReducer,
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
