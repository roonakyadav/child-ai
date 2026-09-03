import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  setupPin,
  isValidPinFormat,
  hasPinConfigured,
  loginWithPin,
  logout,
  updatePin,
} from "./auth";

// Mock API client for all auth tests
vi.mock("./apiClient", () => ({
  post: vi.fn(),
  get: vi.fn(),
}));

describe("PIN Authentication", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up after each test
    localStorage.clear();
  });

  describe("isValidPinFormat", () => {
    it("should accept 4-digit PINs", () => {
      expect(isValidPinFormat("1234")).toBe(true);
      expect(isValidPinFormat("0000")).toBe(true);
      expect(isValidPinFormat("9999")).toBe(true);
    });

    it("should accept 5-digit PINs", () => {
      expect(isValidPinFormat("12345")).toBe(true);
    });

    it("should accept 6-digit PINs", () => {
      expect(isValidPinFormat("123456")).toBe(true);
      expect(isValidPinFormat("000000")).toBe(true);
      expect(isValidPinFormat("999999")).toBe(true);
    });

    it("should reject PINs with less than 4 digits", () => {
      expect(isValidPinFormat("123")).toBe(false);
      expect(isValidPinFormat("12")).toBe(false);
      expect(isValidPinFormat("1")).toBe(false);
      expect(isValidPinFormat("")).toBe(false);
    });

    it("should reject PINs with more than 6 digits", () => {
      expect(isValidPinFormat("1234567")).toBe(false);
      expect(isValidPinFormat("12345678")).toBe(false);
    });

    it("should reject PINs with non-digit characters", () => {
      expect(isValidPinFormat("abcd")).toBe(false);
      expect(isValidPinFormat("12a4")).toBe(false);
      expect(isValidPinFormat("12 34")).toBe(false);
      expect(isValidPinFormat("12-34")).toBe(false);
    });

    it("should reject PINs with special characters", () => {
      expect(isValidPinFormat("12!4")).toBe(false);
      expect(isValidPinFormat("12@4")).toBe(false);
      expect(isValidPinFormat("12#4")).toBe(false);
    });
  });

  describe("setupPin", () => {
    it("should set up a valid 4-digit PIN", async () => {
      const { post } = await import("./apiClient");
      vi.mocked(post).mockResolvedValue({ success: true });

      await expect(setupPin("1234")).resolves.not.toThrow();
      expect(vi.mocked(post)).toHaveBeenCalledWith('/api/auth/parent/setup', { pin: "1234" });
    });

    it("should set up a valid 6-digit PIN", async () => {
      const { post } = await import("./apiClient");
      vi.mocked(post).mockResolvedValue({ success: true });

      await expect(setupPin("123456")).resolves.not.toThrow();
      expect(vi.mocked(post)).toHaveBeenCalledWith('/api/auth/parent/setup', { pin: "123456" });
    });

    it("should reject invalid PIN format", async () => {
      await expect(setupPin("123")).rejects.toThrow("PIN must be 4-6 digits");
      await expect(setupPin("1234567")).rejects.toThrow("PIN must be 4-6 digits");
      await expect(setupPin("abcd")).rejects.toThrow("PIN must be 4-6 digits");
    });

    it("should throw error on API failure", async () => {
      const { post } = await import("./apiClient");
      vi.mocked(post).mockRejectedValue(new Error("Network error"));

      await expect(setupPin("1234")).rejects.toThrow("Failed to set up PIN");
    });
  });

  describe("hasPinConfigured", () => {
    it("should return true when server reports PIN configured", async () => {
      const { get } = await import("./apiClient");
      vi.mocked(get).mockResolvedValue({ configured: true });

      const result = await hasPinConfigured();
      expect(result).toBe(true);
      expect(vi.mocked(get)).toHaveBeenCalledWith('/api/auth/parent/status');
    });

    it("should return false when server reports PIN not configured", async () => {
      const { get } = await import("./apiClient");
      vi.mocked(get).mockResolvedValue({ configured: false });

      const result = await hasPinConfigured();
      expect(result).toBe(false);
    });

    it("should return false on API error", async () => {
      const { get } = await import("./apiClient");
      vi.mocked(get).mockRejectedValue(new Error("Network error"));

      const result = await hasPinConfigured();
      expect(result).toBe(false);
    });
  });

  describe("loginWithPin", () => {
    it("should login with valid PIN", async () => {
      const { post } = await import("./apiClient");
      vi.mocked(post).mockResolvedValue({ success: true });

      const result = await loginWithPin("1234");
      expect(result).toBe(true);
      expect(vi.mocked(post)).toHaveBeenCalledWith('/api/auth/parent/login', { pin: "1234" });
    });

    it("should reject invalid PIN format", async () => {
      await expect(loginWithPin("123")).rejects.toThrow("PIN must be 4-6 digits");
      await expect(loginWithPin("1234567")).rejects.toThrow("PIN must be 4-6 digits");
    });

    it("should return false on authentication failure", async () => {
      const { post } = await import("./apiClient");
      vi.mocked(post).mockResolvedValue({ success: false });

      const result = await loginWithPin("1234");
      expect(result).toBe(false);
    });

    it("should return false on API error", async () => {
      const { post } = await import("./apiClient");
      vi.mocked(post).mockRejectedValue(new Error("Network error"));

      const result = await loginWithPin("1234");
      expect(result).toBe(false);
    });
  });

  describe("updatePin", () => {
    it("should update PIN on server", async () => {
      const { post } = await import("./apiClient");
      vi.mocked(post).mockResolvedValue({ success: true });

      await expect(updatePin("5678")).resolves.not.toThrow();
      expect(vi.mocked(post)).toHaveBeenCalledWith('/api/auth/parent/update', { pin: "5678" });
    });

    it("should reject invalid PIN format", async () => {
      await expect(updatePin("123")).rejects.toThrow("PIN must be 4-6 digits");
      await expect(updatePin("1234567")).rejects.toThrow("PIN must be 4-6 digits");
    });

    it("should throw error on API failure", async () => {
      const { post } = await import("./apiClient");
      vi.mocked(post).mockRejectedValue(new Error("Network error"));

      await expect(updatePin("1234")).rejects.toThrow("Failed to update PIN");
    });
  });

  describe("logout", () => {
    it("should call logout endpoint and clear stale localStorage", async () => {
      const { post } = await import("./apiClient");
      vi.mocked(post).mockResolvedValue({});

      // Set stale localStorage values (from old implementation)
      localStorage.setItem("parent_pin_hash", "stale_hash");
      localStorage.setItem("parent_pin_setup_complete", "true");

      await logout();

      expect(vi.mocked(post)).toHaveBeenCalledWith('/api/auth/parent/logout', {});
      expect(localStorage.getItem("parent_pin_hash")).toBeNull();
      expect(localStorage.getItem("parent_pin_setup_complete")).toBeNull();
    });

    it("should handle API error gracefully", async () => {
      const { post } = await import("./apiClient");
      vi.mocked(post).mockRejectedValue(new Error("Network error"));

      // Set stale localStorage values
      localStorage.setItem("parent_pin_hash", "stale_hash");

      await expect(logout()).resolves.not.toThrow();
      expect(localStorage.getItem("parent_pin_hash")).toBeNull();
    });
  });

  describe("Security: No localStorage PIN storage", () => {
    it("should never write PIN hash to localStorage during setup", async () => {
      const { post } = await import("./apiClient");
      vi.mocked(post).mockResolvedValue({ success: true });

      await setupPin("1234");

      // Verify no PIN-related keys in localStorage
      expect(localStorage.getItem("parent_pin_hash")).toBeNull();
      expect(localStorage.getItem("parent_pin_setup_complete")).toBeNull();
    });

    it("should never write PIN hash to localStorage during login", async () => {
      const { post } = await import("./apiClient");
      vi.mocked(post).mockResolvedValue({ success: true });

      await loginWithPin("1234");

      // Verify no PIN-related keys in localStorage
      expect(localStorage.getItem("parent_pin_hash")).toBeNull();
      expect(localStorage.getItem("parent_pin_setup_complete")).toBeNull();
    });

    it("should obtain PIN status from server, not localStorage", async () => {
      const { get } = await import("./apiClient");
      vi.mocked(get).mockResolvedValue({ configured: true });

      // Set stale localStorage value
      localStorage.setItem("parent_pin_hash", "stale_hash");

      const result = await hasPinConfigured();

      // Should use server response, not localStorage
      expect(result).toBe(true);
      expect(vi.mocked(get)).toHaveBeenCalledWith('/api/auth/parent/status');
    });
  });
});
