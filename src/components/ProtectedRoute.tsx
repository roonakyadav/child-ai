
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Client-side Route Protection
 * 
 * Ensures that only authenticated users can access the parent dashboard.
 * If not authenticated, redirects back to the PIN entry page.
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuth = localStorage.getItem("parent_authenticated") === "true";
  const authTime = localStorage.getItem("parent_auth_time");
  
  // Session Expiration Check (30 minutes)
  const SESSION_TIMEOUT = 30 * 60 * 1000;
  const isExpired = authTime ? (Date.now() - parseInt(authTime)) > SESSION_TIMEOUT : true;

  if (!isAuth || isExpired) {
    // Clean up expired session if any
    if (isAuth && isExpired) {
      localStorage.removeItem("parent_authenticated");
      localStorage.removeItem("parent_auth_time");
    }
    return <Navigate to="/parent" replace />;
  }

  return <>{children}</>;
}
