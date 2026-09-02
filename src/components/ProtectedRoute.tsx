
import { Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { verifySession } from "@/lib/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Server-Backed Route Protection
 * 
 * Ensures that only authenticated users can access the parent dashboard.
 * Uses server-side session verification via HTTP-only cookies.
 * If not authenticated, redirects back to the PIN entry page.
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const isValid = await verifySession();
      setIsAuthenticated(isValid);
    };

    checkSession();
  }, []);

  // Show loading state while checking session
  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Redirect to PIN entry if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/parent" replace />;
  }

  return <>{children}</>;
}
