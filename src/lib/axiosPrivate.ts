import { supabase } from "@/integrations/supabase/client";

interface RequestParams {
  [key: string]: string | number | boolean | null | undefined;
}

interface RequestConfig {
  params?: RequestParams;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface AxiosResponse<T> {
  data: T;
}

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "";

const buildUrl = (url: string, params?: RequestParams) => {
  if (!params) {
    return `${baseURL}${url}`;
  }

  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) =>
      `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
    )
    .join("&");

  if (!query) {
    return `${baseURL}${url}`;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${baseURL}${url}${separator}${query}`;
};

async function request<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  data?: unknown,
  config: RequestConfig = {}
): Promise<AxiosResponse<T>> {
  const { params, headers, signal } = config;
  const requestUrl = buildUrl(url, params);

  const { data: session } = await supabase.auth.getSession();
  const accessToken = session?.session?.access_token;

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...headers,
  };

  if (data !== undefined && data !== null) {
    finalHeaders["Content-Type"] = "application/json";
  }

  const response = await fetch(requestUrl, {
    method,
    headers: finalHeaders,
    body: data ? JSON.stringify(data) : undefined,
    signal,
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;

    try {
      const errorData = await response.json();
      if (typeof errorData?.message === "string") {
        errorMessage = errorData.message;
      } else if (typeof errorData?.error === "string") {
        errorMessage = errorData.error;
      }
    } catch (error) {
      // Ignore JSON parsing errors for non-JSON responses
    }

    throw new Error(errorMessage);
  }

  try {
    const responseData = (await response.json()) as T;
    return { data: responseData };
  } catch (error) {
    // Allow endpoints that return no content
    return { data: undefined as unknown as T };
  }
}

const axiosPrivate = {
  get: async <T>(url: string, config?: RequestConfig) =>
    request<T>("GET", url, undefined, config),
  post: async <T>(url: string, data?: unknown, config?: RequestConfig) =>
    request<T>("POST", url, data, config),
  put: async <T>(url: string, data?: unknown, config?: RequestConfig) =>
    request<T>("PUT", url, data, config),
  patch: async <T>(url: string, data?: unknown, config?: RequestConfig) =>
    request<T>("PATCH", url, data, config),
  delete: async <T>(url: string, config?: RequestConfig) =>
    request<T>("DELETE", url, undefined, config),
};

export default axiosPrivate;
