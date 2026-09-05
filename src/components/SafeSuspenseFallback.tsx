import React from "react";

export interface SafeSuspenseFallbackProps {
  variant?: "fullscreen" | "content";
}

/**
 * Safe, minimal Suspense fallback.
 * Displays a clean loading indicator without exposing internal paths,
 * component names, or technical details.
 */
export const SafeSuspenseFallback: React.FC<SafeSuspenseFallbackProps> = ({
  variant = "fullscreen",
}) => {
  if (variant === "content") {
    return (
      <div
        role="status"
        aria-label="Loading content"
        className="flex min-h-[400px] w-full items-center justify-center p-8"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label="Loading page"
      className="flex min-h-screen w-full items-center justify-center bg-background p-6"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
};

export default SafeSuspenseFallback;
