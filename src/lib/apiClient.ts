/**
 * Centralized API Client for Backend Requests
 * 
 * Provides a single source of truth for all HTTP requests to the backend.
 * Handles URL construction, credentials, timeouts, and error handling.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_TIMEOUT_MS = parseInt(import.meta.env.VITE_API_TIMEOUT_MS || '30000');

/**
 * API Error with typed structure
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
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

    if (!response.ok) {
      throw new ApiError(
        `Request failed with status ${response.status}`,
        response.status,
        response.status >= 500 ? 'SERVER_ERROR' : 'CLIENT_ERROR'
      );
    }

    const text = await response.text();
    
    if (!text) {
      return {} as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError('Invalid JSON response', response.status, 'INVALID_JSON');
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
