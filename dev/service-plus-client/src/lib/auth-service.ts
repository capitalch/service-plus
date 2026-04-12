/**
 * Type Definitions for Authentication API
 */

import axios, { AxiosError } from 'axios';
import { getApiBaseUrl } from './utils';

export type ApiError = {
    errors?: Record<string, string[]>;
    message: string;
    status: number;
};

export type ClientType = {
    id: string;
    name: string;
    is_active: boolean;
};

export type ForgotPasswordRequest = {
    email: string;
};

export type ForgotPasswordResponse = {
    message: string;
    success: boolean;
};

export type SetPasswordResponseType = {
    message: string;
    success: boolean;
};

export type ValidateResetTokenResponseType = {
    full_name: string;
    username: string;
    valid: boolean;
};

export type LoginRequestType = {
    clientId: string;
    emailOrUsername: string;
    password: string;
};

export type BuContextType = {
    code:          string;
    id:            number;
    is_active:     boolean;
    name:          string;
    schema_exists: boolean;
};

export type LoginResponseType = {
    accessToken: string;
    accessRights?: string[] | null | [];
    availableBus?: BuContextType[];
    dbName?: string | null;
    email: string;
    fullName?: string;
    id?: string;
    lastUsedBranchId?: number | null;
    lastUsedBuId?: number | null;
    mobile?: string;
    roleName?: string;
    username: string;
    userType: 'A' | 'B' | 'S';
};

export type SearchClientsResponseType = ClientType[];

export type UserInstanceType = {
    accessRights?: string[] | null | [];
    availableBus?: BuContextType[];
    dbName?: string | null;
    email: string;
    fullName?: string;
    id?: string;
    lastUsedBranchId?: number | null;
    lastUsedBuId?: number | null;
    mobile?: string;
    roleName?: string;
    userType: 'A' | 'B' | 'S';
    username: string;
};

const axiosInstance = axios.create({
    baseURL: getApiBaseUrl(),
    headers: { 'Content-Type': 'application/json' },
});

function extractApiError(err: unknown): ApiError {
    if (err instanceof AxiosError && err.response) {
        return {
            errors: err.response.data?.errors,
            message: err.response.data?.detail || err.response.data?.message || 'Request failed',
            status: err.response.status,
        };
    }
    return { message: 'Request failed', status: 0 };
}

export async function forgotPasswordRequest(data: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    try {
        const response = await axiosInstance.post('/api/auth/forgot-password', data);
        return response.data;
    } catch (err) {
        throw extractApiError(err);
    }
}

export async function loginUser(credentials: LoginRequestType): Promise<LoginResponseType> {
    try {
        const response = await axiosInstance.post('/api/auth/login', credentials);
        return response.data;
    } catch (err) {
        throw extractApiError(err);
    }
}

export async function searchClients(criteria: string): Promise<SearchClientsResponseType> {
    try {
        const response = await axiosInstance.post('/api/auth/clients', { criteria });
        return response.data;
    } catch (err) {
        throw extractApiError(err);
    }
}

export async function sendTestEmail(): Promise<{ detail?: string; message: string; status: string }> {
    try {
        const response = await axiosInstance.post('/api/utils/test-email');
        return response.data;
    } catch (err) {
        throw extractApiError(err);
    }
}

export async function setNewPassword(token: string, newPassword: string): Promise<SetPasswordResponseType> {
    try {
        const response = await axiosInstance.post('/api/auth/set-password', { token, new_password: newPassword });
        return response.data;
    } catch (err) {
        throw extractApiError(err);
    }
}

export async function validateResetToken(token: string): Promise<ValidateResetTokenResponseType> {
    try {
        const response = await axiosInstance.post('/api/auth/validate-reset-token', { token });
        return response.data;
    } catch (err) {
        throw extractApiError(err);
    }
}
