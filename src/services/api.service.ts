import { ApiResponse } from "@/types";
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";

const BASE_API_URL = "https://auth.appleby.cloud";

const axiosApi = axios.create({
    baseURL: BASE_API_URL,
    headers: {
        "Content-Type": "application/json",
    },
    validateStatus: () => true,
    withCredentials: true,
    timeout: 10000,
});

export const fetchApi = async <T>(
    config: AxiosRequestConfig,
): Promise<ApiResponse<T>> => {
    try {
        const response = await executeRequest<T>(config, null);

        if (response.status === 401) {
            const refreshResult = await handle401Response<T>(config);
            if (refreshResult) return refreshResult;
        }

        return response;
    } catch (err: unknown) {
        const axiosError = err as AxiosError;
        return {
            success: false,
            status: axiosError.response?.status ?? 500,
            error: "request_failed",
            error_message: axiosError.message ?? "Request failed unexpectedly",
            error_code: -1,
        };
    }
};

const handle401Response = async <T>(
    originalConfig: AxiosRequestConfig,
): Promise<ApiResponse<T> | null> => {
    try {
        const refreshResponse = await axios.post(
            `${BASE_API_URL}/auth/refresh`,
            {},
            { withCredentials: true },
        );

        if (refreshResponse.status === 200 && refreshResponse.data.success) {
            const newToken = refreshResponse.data.data.token;
            return await executeRequest<T>(originalConfig, newToken);
        }
    } catch {
        // Refresh failed — fall through and return null
    }
    return null;
};

const executeRequest = async <T>(
    config: AxiosRequestConfig,
    token: string | null,
): Promise<ApiResponse<T>> => {
    const requestConfig: AxiosRequestConfig = {
        ...config,
        headers: {
            ...config.headers,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    };

    const response: AxiosResponse = await axiosApi.request(requestConfig);

    if (response.data?.success) {
        return {
            success: true,
            status: response.status,
            message: response.data.message,
            data: response.data.data as T,
        };
    }

    return {
        success: false,
        status: response.status,
        error: response.data?.error ?? "unknown_error",
        error_message: response.data?.error_message ?? "An unexpected error occurred",
        error_code: response.data?.error_code ?? 0,
    };
};