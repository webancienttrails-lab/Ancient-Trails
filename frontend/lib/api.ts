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
  options: RequestInit = {}
): Promise<ApiResponse<TData>> {
  const { signal: providedSignal, ...requestOptions } = options;
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(
    () => timeoutController.abort(),
    DEFAULT_API_TIMEOUT_MS
  );
  const abortRequest = () => timeoutController.abort();
  const headers = new Headers(requestOptions.headers);

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
