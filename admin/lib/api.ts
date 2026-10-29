export const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
).replace(/\/$/, "");

export type ApiResponse<TData> = {
  success: boolean;
  message: string;
  data: TData;
  details?: unknown;
};

export class ApiError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);

    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const DEFAULT_API_TIMEOUT_MS = 10_000;

async function readResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json();
}

export async function apiRequest<TData>(
  path: string,
  options: RequestInit = {},
  allowSessionRefresh = true
): Promise<ApiResponse<TData>> {
  const { signal: providedSignal, ...requestOptions } = options;
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(
    () => timeoutController.abort(),
    DEFAULT_API_TIMEOUT_MS
  );
  const abortRequest = () => timeoutController.abort();

  if (providedSignal?.aborted) {
    timeoutController.abort();
  } else {
    providedSignal?.addEventListener("abort", abortRequest, { once: true });
  }

  const headers = cookieHeaders(requestOptions.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...requestOptions,
      headers,
      credentials: "include",
      signal: timeoutController.signal,
    });
  } catch (error) {
    if (timeoutController.signal.aborted) {
      throw new ApiError(
        408,
        "Request timed out. Please check if the backend server is running."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
    providedSignal?.removeEventListener("abort", abortRequest);
  }

  const expectedSessionId = headers.get("X-Session-Id");
  if (response.status === 401 && allowSessionRefresh && expectedSessionId
      && path !== "/api/auth/refresh" && path !== "/api/auth/logout") {
    const auth = await import("@/lib/admin-auth");
    try {
      const session = typeof auth.refreshAdminSession === "function"
        ? await auth.refreshAdminSession(expectedSessionId) : null;
      if (session) return apiRequest<TData>(path, options, false);
    } catch (error) {
      if (!(error instanceof ApiError) || error.statusCode !== 401) throw error;
    }
  }

  const body = (await readResponse(response)) as Partial<ApiResponse<TData>> | null;

  if (!response.ok) {
    if (response.status === 401 && expectedSessionId && path !== "/api/auth/logout") {
      const { clearAdminSession, getAdminSession } = await import("@/lib/admin-auth");
      if (getAdminSession()?.sessionId === expectedSessionId) clearAdminSession();
    }

    throw new ApiError(
      response.status,
      body?.message || "Request failed",
      body?.details
    );
  }

  if (!body) {
    throw new ApiError(response.status, "Invalid API response");
  }

  return body as ApiResponse<TData>;
}

function cookieHeaders(source?: HeadersInit): Headers {
  const headers = new Headers(source);
  headers.delete("Authorization");
  headers.set("X-Requested-With", "XMLHttpRequest");
  headers.set("X-Session-Audience", "admin");
  return headers;
}

// Uploads refresh once while preserving multipart boundaries and file contents.
export async function sessionFetch(url: string, options: RequestInit): Promise<Response> {
  const request = { ...options, credentials: "include" as const, headers: cookieHeaders(options.headers) };
  const response = await fetch(url, request);
  const expectedSessionId = request.headers.get("X-Session-Id");
  if (response.status !== 401 || !expectedSessionId) return response;
  const { refreshAdminSession } = await import("@/lib/admin-auth");
  try {
    const session = await refreshAdminSession(expectedSessionId);
    if (session) return fetch(url, request);
  } catch (error) {
    if (!(error instanceof ApiError) || error.statusCode !== 401) throw error;
  }
  return response;
}
