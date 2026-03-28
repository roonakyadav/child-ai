
/**
 * Parent Authentication Utility
 * 
 * Handles secure PIN storage using simple hashing and session management.
 */

const PIN_STORAGE_KEY = "parent_pin_hash";
const DEFAULT_PIN = "1234"; // Default for initial setup

/**
 * Simple hashing function for the 4-digit PIN
 * Note: While not enterprise-grade, it's better than plain text for local storage.
 */
async function hashPin(pin: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Initialize a default PIN if none exists
 */
export async function ensurePinExists(): Promise<void> {
  if (!localStorage.getItem(PIN_STORAGE_KEY)) {
    const defaultHash = await hashPin(DEFAULT_PIN);
    localStorage.setItem(PIN_STORAGE_KEY, defaultHash);
  }
}

/**
 * Verify if the entered PIN matches the stored hash
 */
export async function verifyPin(enteredPin: string): Promise<boolean> {
  await ensurePinExists();
  const storedHash = localStorage.getItem(PIN_STORAGE_KEY);
  const enteredHash = await hashPin(enteredPin);
  return storedHash === enteredHash;
}

/**
 * Update the stored PIN hash
 */
export async function updatePin(newPin: string): Promise<void> {
  if (newPin.length !== 4) throw new Error("PIN must be 4 digits");
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
