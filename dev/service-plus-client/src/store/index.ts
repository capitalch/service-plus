import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/auth-slice';
import { superAdminReducer } from '@/features/super-admin/super-admin-slice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    superAdmin: superAdminReducer,
  },
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
