
/**
 * Parent Authentication Utility
 *
 * Handles server-backed PIN authentication with HTTP-only session cookies.
 * PIN hash is stored server-side only, never in browser localStorage.
 */

import { post, get } from './apiClient';

/**
 * Validate PIN format (4-6 digits)
 */
export function isValidPinFormat(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

/**
 * Check if a PIN has been configured on the server
 */
export async function hasPinConfigured(): Promise<boolean> {
  try {
    const data = await get<{ configured: boolean }>('/api/auth/parent/status');
    return data.configured === true;
  } catch (error) {
    console.error('PIN status check error:', error);
    return false;
  }
}

/**
 * Set up a new PIN on the server
 */
export async function setupPin(pin: string): Promise<void> {
  if (!isValidPinFormat(pin)) {
    throw new Error("PIN must be 4-6 digits");
  }

  try {
    await post<{ success: boolean }>('/api/auth/parent/setup', { pin });
  } catch (error) {
    console.error('PIN setup error:', error);
    throw new Error('Failed to set up PIN');
  }
}

/**
 * Login with PIN using server verification
 * This creates a server-backed session with HTTP-only cookie
 */
export async function loginWithPin(pin: string): Promise<boolean> {
  if (!isValidPinFormat(pin)) {
    throw new Error("PIN must be 4-6 digits");
  }

  try {
    const data = await post<{ success: boolean }>('/api/auth/parent/login', { pin });
    return data.success === true;
  } catch (error) {
    console.error('Login error:', error);
    return false;
  }
}

/**
 * Update PIN on server
 */
export async function updatePin(newPin: string): Promise<void> {
  if (!isValidPinFormat(newPin)) {
    throw new Error("PIN must be 4-6 digits");
  }

  try {
    await post<{ success: boolean }>('/api/auth/parent/update', { pin: newPin });
  } catch (error) {
    console.error('PIN update error:', error);
    throw new Error('Failed to update PIN');
  }
}

/**
 * Verify server session
 * Checks if the current HTTP-only cookie represents a valid authenticated session
 */
export async function verifySession(): Promise<boolean> {
  try {
    const data = await get<{ authenticated: boolean }>('/api/auth/parent/session');
    return data.authenticated === true;
  } catch (error) {
    console.error('Session verification error:', error);
    return false;
  }
}

/**
 * Logout from server session
 * Invalidates the server-side session and clears the cookie
 * Also clears any stale sensitive data from localStorage (backward compatibility)
 */
export async function logout(): Promise<void> {
  try {
    await post('/api/auth/parent/logout', {});
  } catch (error) {
    console.error('Logout error:', error);
  }

  // Clear stale sensitive data from localStorage (backward compatibility for old installations)
  localStorage.removeItem("parent_pin_hash");
  localStorage.removeItem("parent_pin_setup_complete");
}

/**
 * Check if the app is in Strict Mode
 */
export function isStrictModeEnabled(): boolean {
  try {
    const settings = JSON.parse(localStorage.getItem("ai_settings") || "{}");
    return !!settings.strictMode;
  } catch {
    return false;
  }
}

/**
 * Toggle Strict Mode
 */
export function setStrictMode(enabled: boolean): void {
  const settings = JSON.parse(localStorage.getItem("ai_settings") || "{}");
  settings.strictMode = enabled;
  localStorage.setItem("ai_settings", JSON.stringify(settings));
}
