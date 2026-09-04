/**
 * Centralized API Configuration
 * Provides type-safe API endpoint configuration with environment variable support
 */

// Validate that VITE_API_URL is set in production builds
const API_BASE_URL = import.meta.env.VITE_API_URL;

if (import.meta.env.PROD && !API_BASE_URL) {
  throw new Error(
    'VITE_API_URL environment variable is required in production builds. ' +
    'Please set VITE_API_URL to your backend API URL.'
  );
}

// Development fallback for local development
const FALLBACK_URL = 'http://localhost:3001';

export const API_BASE = API_BASE_URL || FALLBACK_URL;

/**
 * API Endpoints Configuration
 * Centralized endpoint paths to ensure consistency across the application
 */
export const API_ENDPOINTS = {
  chat: '/api/chat',
  insights: '/api/insights',
  deepAnalysis: '/api/deep-analysis',
  detectRisk: '/api/detect-risk',
  analyzePattern: '/api/analyze-pattern',
  analyzeEarlyRisk: '/api/analyze-early-risk',
  analyzeSentiment: '/api/analyze-sentiment',
  analyzeIntervention: '/api/analyze-intervention',
  analyzeIntelligence: '/api/analyze-intelligence',
  decisionEngine: '/api/decision-engine',
  generateFullReport: '/api/generate-full-report',
  analyzeEngagement: '/api/analyze-engagement',
  parentConfig: '/api/config/parent',
  migrateConfig: '/api/config/parent/migrate',
} as const;

/**
 * Type-safe API endpoint keys
 */
export type ApiEndpointKey = keyof typeof API_ENDPOINTS;

/**
 * Get full URL for an API endpoint
 * @param endpoint - The endpoint key or full path
 * @returns Complete URL with base URL
 */
export function getApiUrl(endpoint: string): string {
  return `${API_BASE}${endpoint}`;
}

/**
 * Get full URL for a typed API endpoint
 * @param endpoint - The endpoint key
 * @returns Complete URL with base URL
 */
export function getTypedApiUrl(endpoint: ApiEndpointKey): string {
  return getApiUrl(API_ENDPOINTS[endpoint]);
}
