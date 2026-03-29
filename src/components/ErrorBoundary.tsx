import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    localStorage.removeItem("app_dynamic_config"); // Reset potentially corrupt config
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl p-10 text-center border border-muted/20">
            <div className="h-20 w-20 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="h-10 w-10" />
            </div>
            
            <h1 className="text-2xl font-black text-foreground mb-4 tracking-tight">
              Oops! Something went wrong
            </h1>
            
            <p className="text-muted-foreground font-bold text-sm mb-8 leading-relaxed">
              We encountered an unexpected error. This might be due to a configuration issue or a temporary glitch.
            </p>

            <div className="space-y-4">
              <button
                onClick={() => window.location.reload()}
                className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <RefreshCw className="h-4 w-4" />
                Reload Page
              </button>
              
              <button
                onClick={this.handleReset}
                className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-secondary text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Home className="h-4 w-4" />
                Reset & Go Home
              </button>
            </div>
            
            {process.env.NODE_ENV === "development" && (
              <div className="mt-8 p-4 bg-muted/5 rounded-2xl text-left overflow-auto max-h-40">
                <p className="text-[10px] font-mono text-destructive">
                  {this.state.error?.toString()}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
