/**
 * Type Definitions for Authentication API
 */

import axios, { AxiosError } from 'axios';

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

export type LoginRequestType = {
  clientId: string;
  emailOrUsername: string;
  password: string;
};

export type LoginResponseType = {
  accessToken: string;
  accessRights?: string[] | null | [];
  email: string;
  fullName?: string;
  id?: string;
  mobile?: string;
  roleName?: string;
  username: string;
  userType: 'A' | 'B' | 'S';
};

export type SearchClientsResponseType = ClientType[]; // Assuming the API returns an array of clients
// {
//   clients: ClientType[];
//   total: number;
// };

export type UserInstanceType = {
  accessRights?: string[] | null | [];
  email: string;
  fullName?: string;
  id?: string;
  mobile?: string;
  roleName?: string;
  userType: 'A' | 'B' | 'S';
  username: string;
};

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
});

function extractApiError(err: unknown): ApiError {
  if (err instanceof AxiosError && err.response) {
    return {
      errors: err.response.data?.errors,
      message: err.response.data?.message || 'Request failed',
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
