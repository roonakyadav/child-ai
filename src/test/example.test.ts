import { describe, it, expect } from "vitest";

describe("example", () => {
  it("should pass", () => {
    expect(true).toBe(true);
  });
});

// Import the actual auth tests
import "./../lib/auth.test";
