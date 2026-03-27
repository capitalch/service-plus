import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/auth-slice';
import { adminReducer } from '@/features/admin/store/admin-slice';
import { contextReducer } from '@/store/context-slice';
import { superAdminReducer } from '@/features/super-admin/store/super-admin-slice';

export const store = configureStore({
  reducer: {
    admin:      adminReducer,
    auth:       authReducer,
    context:    contextReducer,
    superAdmin: superAdminReducer,
  },
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
