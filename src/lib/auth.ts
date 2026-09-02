
/**
 * Parent Authentication Utility
 * 
 * Handles secure PIN storage using simple hashing and server-backed session management.
 */

import { getApiUrl } from "./apiConfig";

const PIN_STORAGE_KEY = "parent_pin_hash";
const PIN_SETUP_KEY = "parent_pin_setup_complete";

/**
 * Simple hashing function for the PIN
 * Note: While not enterprise-grade, it's better than plain text for local storage.
 */
async function hashPin(pin: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if a PIN has been configured
 */
export function hasPinConfigured(): boolean {
  return localStorage.getItem(PIN_STORAGE_KEY) !== null;
}

/**
 * Get the stored PIN hash (for server verification)
 */
export function getStoredPinHash(): string | null {
  return localStorage.getItem(PIN_STORAGE_KEY);
}

/**
 * Check if PIN setup is complete (for first-run flow)
 */
export function isPinSetupComplete(): boolean {
  return localStorage.getItem(PIN_SETUP_KEY) === "true";
}

/**
 * Complete the PIN setup process
 */
export function markPinSetupComplete(): void {
  localStorage.setItem(PIN_SETUP_KEY, "true");
}

/**
 * Set up a new PIN (for first-time setup)
 */
export async function setupPin(pin: string): Promise<void> {
  if (!isValidPinFormat(pin)) {
    throw new Error("PIN must be 4-6 digits");
  }
  
  const hash = await hashPin(pin);
  localStorage.setItem(PIN_STORAGE_KEY, hash);
  markPinSetupComplete();
}

/**
 * Validate PIN format (4-6 digits)
 */
export function isValidPinFormat(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

/**
 * Verify if the entered PIN matches the stored hash (local verification only)
 * For actual authentication, use loginWithPin()
 */
export async function verifyPin(enteredPin: string): Promise<boolean> {
  const storedHash = localStorage.getItem(PIN_STORAGE_KEY);
  
  if (!storedHash) {
    return false; // No PIN configured
  }
  
  const enteredHash = await hashPin(enteredPin);
  return storedHash === enteredHash;
}

/**
 * Login with PIN using server verification
 * This creates a server-backed session with HTTP-only cookie
 */
export async function loginWithPin(pin: string): Promise<boolean> {
  const storedPinHash = getStoredPinHash();
  
  if (!storedPinHash) {
    throw new Error("No PIN configured");
  }

  try {
    const response = await fetch(getApiUrl('/api/auth/parent/login'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pin,
        storedPinHash
      }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Login error:', error);
    return false;
  }
}

/**
 * Verify server session
 * Checks if the current HTTP-only cookie represents a valid authenticated session
 */
export async function verifySession(): Promise<boolean> {
  try {
    const response = await fetch(getApiUrl('/api/auth/parent/session'), {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.authenticated === true;
  } catch (error) {
    console.error('Session verification error:', error);
    return false;
  }
}

/**
 * Logout from server session
 * Invalidates the server-side session and clears the cookie
 */
export async function logout(): Promise<void> {
  try {
    await fetch(getApiUrl('/api/auth/parent/logout'), {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    console.error('Logout error:', error);
  }
}

/**
 * Update the stored PIN hash
 */
export async function updatePin(newPin: string): Promise<void> {
  if (!isValidPinFormat(newPin)) {
    throw new Error("PIN must be 4-6 digits");
  }
  const newHash = await hashPin(newPin);
  localStorage.setItem(PIN_STORAGE_KEY, newHash);
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
