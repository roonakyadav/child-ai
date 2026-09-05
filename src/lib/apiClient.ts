/**
 * Centralized API Client for Backend Requests
 * 
 * Provides a single source of truth for all HTTP requests to the backend.
 * Handles URL construction, credentials, timeouts, and error handling.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_TIMEOUT_MS = parseInt(import.meta.env.VITE_API_TIMEOUT_MS || '30000');

/**
 * Typed API Error Codes
 */
export type ApiErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'INVALID_JSON'
  | 'CLIENT_ERROR'
  | 'SERVER_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'UNKNOWN_ERROR';

/**
 * Return a safe, friendly message suitable for UI display
 */
export function getSafeUserMessage(code: ApiErrorCode, _status?: number): string {
  switch (code) {
    case 'NETWORK_ERROR':
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    case 'TIMEOUT':
      return 'The request took too long to complete. Please try again.';
    case 'UNAUTHORIZED':
      return 'Authentication required. Please sign in again.';
    case 'FORBIDDEN':
      return 'Access is restricted or the application is currently locked by a parent.';
    case 'NOT_FOUND':
      return 'The requested resource could not be found.';
    case 'RATE_LIMITED':
      return 'Too many requests. Please wait a moment before trying again.';
    case 'SERVICE_UNAVAILABLE':
      return 'Service is temporarily unavailable. Please try again shortly.';
    case 'INVALID_JSON':
      return 'Received an unexpected response from the server. Please try again.';
    case 'SERVER_ERROR':
      return 'An unexpected server error occurred. Please try again.';
    case 'CLIENT_ERROR':
    case 'UNKNOWN_ERROR':
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Helper to safely extract a user-facing error string from any error
 */
export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.safeMessage;
  }
  return 'An unexpected error occurred. Please try again.';
}

/**
 * API Error with typed structure, status, request correlation, and safe UI message
 */
export class ApiError extends Error {
  public readonly status?: number;
  public readonly code: ApiErrorCode;
  public readonly requestId?: string;
  public readonly safeMessage: string;

  constructor(
    message: string,
    status?: number,
    code: ApiErrorCode = 'UNKNOWN_ERROR',
    requestId?: string,
    safeMessage?: string
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.safeMessage = safeMessage || getSafeUserMessage(code, status);
  }
}

/**
 * Request options interface
 */
interface RequestOptions {
  credentials?: RequestCredentials;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Generic GET request
 */
export async function get<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  return request<T>(endpoint, { ...options, method: 'GET' });
}

/**
 * Generic POST request
 */
export async function post<T>(endpoint: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  return request<T>(endpoint, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

/**
 * Generic PUT request
 */
export async function put<T>(endpoint: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  return request<T>(endpoint, {
    ...options,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

/**
 * Generic DELETE request
 */
export async function del<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  return request<T>(endpoint, { ...options, method: 'DELETE' });
}

/**
 * Core request function with timeout and error handling
 */
async function request<T>(endpoint: string, options: RequestOptions & { method: string; body?: string }): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  const timeout = options.timeout || API_TIMEOUT_MS;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      credentials: options.credentials || 'include',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const requestId = typeof response.headers?.get === 'function' ? (response.headers.get('x-request-id') || undefined) : undefined;

    if (!response.ok) {
      let code: ApiErrorCode = 'CLIENT_ERROR';
      if (response.status === 401) code = 'UNAUTHORIZED';
      else if (response.status === 403) code = 'FORBIDDEN';
      else if (response.status === 404) code = 'NOT_FOUND';
      else if (response.status === 429) code = 'RATE_LIMITED';
      else if (response.status === 503) code = 'SERVICE_UNAVAILABLE';
      else if (response.status >= 500) code = 'SERVER_ERROR';

      throw new ApiError(
        `Request failed with status ${response.status}`,
        response.status,
        code,
        requestId
      );
    }

    const text = await response.text();
    
    if (!text) {
      return {} as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError('Invalid JSON response', response.status, 'INVALID_JSON', requestId);
    }
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('Request timeout', undefined, 'TIMEOUT');
    }

    if (error instanceof TypeError) {
      throw new ApiError('Network error', undefined, 'NETWORK_ERROR');
    }

    throw new ApiError('Request failed', undefined, 'UNKNOWN_ERROR');
  }
}

/**
 * Get the API base URL (for compatibility with existing code)
 */
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
