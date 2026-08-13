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
  const headers = new Headers(options.headers);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
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
