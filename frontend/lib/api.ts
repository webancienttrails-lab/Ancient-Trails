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
const PUBLIC_CACHE_MS = 60_000;
const publicResponses = new Map<string, { expiresAt: number; promise: Promise<ApiResponse<unknown>> }>();

export function invalidatePublicApiCache(path?: string) {
  for (const key of publicResponses.keys()) {
    if (!path || key === path || key.startsWith(path + "?")) publicResponses.delete(key);
  }
}

function canCachePublicRequest(path: string, options: RequestInit) {
  if ((options.method || "GET").toUpperCase() !== "GET" || options.body || options.signal || options.cache === "reload") return false;
  if ([...new Headers(options.headers).keys()].length) return false;
  // Keep sessions, bookings, payments and user data outside the shared cache.
  return /^\/api\/(?:site-settings|home|mega-menu|destinations|experts|about|faq|tour-calendar|tours(?:\/(?:departures|itineraries))?|blogs(?:\/[^/]+)?|experiences(?:\/[^/]+)?)$/.test(path.split("?")[0]);
}

export async function apiRequest<TData>(path: string, options: RequestInit = {}, allowSessionRefresh = true): Promise<ApiResponse<TData>> {
  if (!canCachePublicRequest(path, options)) return performApiRequest<TData>(path, options, allowSessionRefresh);
  const existing = publicResponses.get(path);
  if (existing && existing.expiresAt > Date.now()) return JSON.parse(JSON.stringify(await existing.promise)) as ApiResponse<TData>;
  // One TTL on server and browser avoids stacking stale framework/HTTP caches.
  const publicOptions = { ...options, credentials: "omit" as const, cache: "no-store" as const };
  const entry = { expiresAt: Infinity, promise: performApiRequest<unknown>(path, publicOptions, false) };
  entry.promise = entry.promise.then(result => {
    if (result.success) entry.expiresAt = Date.now() + PUBLIC_CACHE_MS;
    else if (publicResponses.get(path) === entry) publicResponses.delete(path);
    return result;
  }).catch(error => {
    if (publicResponses.get(path) === entry) publicResponses.delete(path);
    throw error;
  });
  if (publicResponses.size >= 100) publicResponses.delete(publicResponses.keys().next().value!);
  publicResponses.set(path, entry);
  return JSON.parse(JSON.stringify(await entry.promise)) as ApiResponse<TData>;
}

async function readResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json();
}

async function performApiRequest<TData>(
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
  const headers = cookieHeaders(requestOptions.headers);

  if (requestOptions.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (providedSignal?.aborted) {
    timeoutController.abort();
  } else {
    providedSignal?.addEventListener("abort", abortRequest, { once: true });
  }

  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...requestOptions,
      headers,
      credentials: requestOptions.credentials || "include",
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
    const auth = await import("@/lib/auth");
    try {
      const session = typeof auth.refreshTravellerSession === "function"
        ? await auth.refreshTravellerSession(expectedSessionId) : null;
      if (session) return apiRequest<TData>(path, options, false);
    } catch (error) {
      if (!(error instanceof ApiError) || error.statusCode !== 401) throw error;
    }
  }

  const body = (await readResponse(response)) as Partial<ApiResponse<TData>> | null;

  if (!response.ok) {
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
  headers.set("X-Session-Audience", "traveller");
  return headers;
}

// Uploads refresh once while preserving multipart boundaries and file contents.
export async function sessionFetch(url: string, options: RequestInit): Promise<Response> {
  const request = { ...options, credentials: "include" as const, headers: cookieHeaders(options.headers) };
  const response = await fetch(url, request);
  const expectedSessionId = request.headers.get("X-Session-Id");
  if (response.status !== 401 || !expectedSessionId) return response;
  const { refreshTravellerSession } = await import("@/lib/auth");
  try {
    const session = await refreshTravellerSession(expectedSessionId);
    if (session) return fetch(url, request);
  } catch (error) {
    if (!(error instanceof ApiError) || error.statusCode !== 401) throw error;
  }
  return response;
}
