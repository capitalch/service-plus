import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL || "http://localhost:4000/api",
  prepareHeaders: (headers) => {
    const token = localStorage.getItem("authToken");
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
    return headers;
  },
});

export const api = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: ["Auth", "Reports", "Files"],
  endpoints: (builder) => ({
    // Auth endpoints
    login: builder.mutation<
      { user: { id: string; email: string; name: string; roles: string[] }; token: string },
      { email: string; password: string }
    >({
      query: (credentials) => ({
        url: "/auth/login",
        method: "POST",
        body: credentials,
      }),
      invalidatesTags: ["Auth"],
    }),

    logout: builder.mutation<void, void>({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
      }),
      invalidatesTags: ["Auth"],
    }),

    refreshToken: builder.mutation<{ token: string }, void>({
      query: () => ({
        url: "/auth/refresh",
        method: "POST",
      }),
    }),

    // File upload endpoints
    uploadFile: builder.mutation<
      { id: string; url: string; filename: string },
      FormData
    >({
      query: (formData) => ({
        url: "/files/upload",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["Files"],
    }),

    uploadMultipleFiles: builder.mutation<
      { files: { id: string; url: string; filename: string }[] },
      FormData
    >({
      query: (formData) => ({
        url: "/files/upload-multiple",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["Files"],
    }),

    deleteFile: builder.mutation<void, string>({
      query: (fileId) => ({
        url: `/files/${fileId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Files"],
    }),

    // Reports export endpoints
    exportTicketsReport: builder.query<Blob, { format: "csv" | "pdf" | "xlsx"; filters?: Record<string, unknown> }>({
      query: ({ format, filters }) => ({
        url: "/reports/tickets",
        method: "POST",
        body: { format, filters },
        responseHandler: (response) => response.blob(),
      }),
      providesTags: ["Reports"],
    }),

    exportClientsReport: builder.query<Blob, { format: "csv" | "pdf" | "xlsx"; filters?: Record<string, unknown> }>({
      query: ({ format, filters }) => ({
        url: "/reports/clients",
        method: "POST",
        body: { format, filters },
        responseHandler: (response) => response.blob(),
      }),
      providesTags: ["Reports"],
    }),

    exportBillingReport: builder.query<Blob, { format: "csv" | "pdf" | "xlsx"; dateRange?: { start: string; end: string } }>({
      query: ({ format, dateRange }) => ({
        url: "/reports/billing",
        method: "POST",
        body: { format, dateRange },
        responseHandler: (response) => response.blob(),
      }),
      providesTags: ["Reports"],
    }),
  }),
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useRefreshTokenMutation,
  useUploadFileMutation,
  useUploadMultipleFilesMutation,
  useDeleteFileMutation,
  useLazyExportTicketsReportQuery,
  useLazyExportClientsReportQuery,
  useLazyExportBillingReportQuery,
} = api;
