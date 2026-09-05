import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw, MessageSquarePlus } from "lucide-react";
import { clearChildSessionData } from "@/lib/childSession";
import { safeError } from "@/lib/safeLogger";

export interface ErrorBoundaryProps {
  children: ReactNode;
  variant?: "child" | "parent" | "auto";
  fallback?: ReactNode | ((props: { error: Error | null; resetErrorBoundary: () => void }) => ReactNode);
  onReset?: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
    safeError("ErrorBoundary caught render crash", error);
  }

  public resetErrorBoundary = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  private handleChildRecovery = () => {
    try {
      clearChildSessionData();
    } catch {
      // Safe fallback if session clearance fails
    }
    this.resetErrorBoundary();
    if (typeof window !== "undefined") {
      if (window.location.pathname === "/") {
        window.location.reload();
      } else {
        window.location.href = "/";
      }
    }
  };

  private handleParentRecovery = () => {
    this.resetErrorBoundary();
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  private isParentContext(): boolean {
    if (this.props.variant === "parent") return true;
    if (this.props.variant === "child") return false;
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/parent")) {
      return true;
    }
    return false;
  }

  public render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === "function") {
        return this.props.fallback({
          error: this.state.error,
          resetErrorBoundary: this.resetErrorBoundary,
        });
      }

      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isParent = this.isParentContext();

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl p-10 text-center border border-muted/20">
            <div className="h-20 w-20 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="h-10 w-10" />
            </div>

            <h1 className="text-2xl font-black text-foreground mb-4 tracking-tight">
              Something went wrong.
            </h1>

            <p className="text-muted-foreground font-bold text-sm mb-8 leading-relaxed">
              {isParent
                ? "Something went wrong. Please reload the dashboard."
                : "Something went wrong. Please start a new chat."}
            </p>

            <div className="space-y-4">
              {isParent ? (
                <button
                  type="button"
                  onClick={this.handleParentRecovery}
                  className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reload Dashboard
                </button>
              ) : (
                <button
                  type="button"
                  onClick={this.handleChildRecovery}
                  className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <MessageSquarePlus className="h-4 w-4" />
                  Start New Chat
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
