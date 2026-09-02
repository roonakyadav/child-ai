import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ShieldCheck, AlertCircle, ArrowRight } from "lucide-react";
import { setupPin, isValidPinFormat, markPinSetupComplete, loginWithPin } from "@/lib/auth";

type SetupStep = "create" | "confirm" | "success";

export default function PinSetup() {
  const [step, setStep] = useState<SetupStep>("create");
  const [pin, setPin] = useState<string[]>(["", "", "", "", "", ""]);
  const [confirmPin, setConfirmPin] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  
  const createInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  
  const confirmInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Auto-focus first box on mount or step change
  useEffect(() => {
    const refs = step === "create" ? createInputRefs : confirmInputRefs;
    refs[0].current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const handleChange = (index: number, value: string, isConfirm: boolean) => {
    if (!/^\d*$/.test(value)) return;

    const currentPin = isConfirm ? confirmPin : pin;
    const newPin = [...currentPin];
    newPin[index] = value.slice(-1);
    
    if (isConfirm) {
      setConfirmPin(newPin);
    } else {
      setPin(newPin);
    }

    // Move to next box if value entered
    const refs = isConfirm ? confirmInputRefs : createInputRefs;
    if (value && index < 5) {
      refs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent, isConfirm: boolean) => {
    const currentPin = isConfirm ? confirmPin : pin;
    if (e.key === "Backspace" && !currentPin[index] && index > 0) {
      const refs = isConfirm ? confirmInputRefs : createInputRefs;
      refs[index - 1].current?.focus();
    }
  };

  const handleCreateSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const pinString = pin.join("");
    
    if (pinString.length < 4) {
      setError("PIN must be at least 4 digits");
      return;
    }
    
    if (!isValidPinFormat(pinString)) {
      setError("PIN must be 4-6 digits");
      return;
    }
    
    setError("");
    setStep("confirm");
  }, [pin]);

  const handleConfirmSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const confirmPinString = confirmPin.join("");
    
    if (confirmPinString.length < 4) {
      setError("PIN must be at least 4 digits");
      return;
    }
    
    const pinString = pin.join("");
    if (pinString !== confirmPinString) {
      setError("PINs do not match");
      setConfirmPin(["", "", "", "", "", ""]);
      confirmInputRefs[0].current?.focus();
      return;
    }
    
    setError("");
    setIsSubmitting(true);
    
    try {
      await setupPin(pinString);
      
      // Login with the newly set PIN to create server session
      const loginSuccess = await loginWithPin(pinString);
      
      if (!loginSuccess) {
        setError("Failed to create session. Please try again.");
        setIsSubmitting(false);
        return;
      }
      
      setStep("success");
      
      // Navigate to dashboard after success animation
      setTimeout(() => {
        navigate("/parent-dashboard/overview");
      }, 1500);
    } catch (err) {
      setError("Failed to set up PIN. Please try again.");
      setIsSubmitting(false);
    }
  }, [confirmPin, pin, navigate]);

  // Auto-submit when minimum 4 digits are entered
  useEffect(() => {
    const currentPin = step === "create" ? pin : confirmPin;
    const pinString = currentPin.join("");
    if (pinString.length >= 4 && currentPin.every(digit => digit !== "")) {
      if (step === "create") {
        handleCreateSubmit();
      } else {
        handleConfirmSubmit();
      }
    }
  }, [pin, confirmPin, step, handleCreateSubmit, handleConfirmSubmit]);

  const renderPinInputs = (currentPin: string[], refs: Array<React.RefObject<HTMLInputElement>>, isConfirm: boolean) => (
    <div className="flex justify-between gap-3">
      {currentPin.map((digit, index) => (
        <input
          key={index}
          ref={refs[index]}
          type="password"
          value={digit}
          onChange={(e) => handleChange(index, e.target.value, isConfirm)}
          onKeyDown={(e) => handleKeyDown(index, e, isConfirm)}
          maxLength={1}
          className={`h-16 w-12 rounded-2xl border text-center text-2xl font-black outline-none transition-all duration-200 ${
            error 
              ? "border-destructive bg-destructive/5 text-destructive shadow-[0_0_15px_rgba(239,68,68,0.1)]" 
              : "border-primary/10 bg-primary/5 text-primary focus:border-primary focus:ring-8 focus:ring-primary/10"
          }`}
          autoComplete="off"
        />
      ))}
    </div>
  );

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f8faff] selection:bg-primary/20">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-1/4 -left-32 h-80 w-80 rounded-full bg-secondary/15 blur-3xl" />
        <div className="absolute inset-0 bg-white/10 backdrop-blur-md" />
        <div className="absolute inset-0 bg-black/5" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-[420px] px-6"
      >
        <div className="overflow-hidden rounded-[40px] border border-white bg-white/90 p-10 shadow-2xl shadow-primary/10 backdrop-blur-xl">
          
          {/* Header */}
          <div className="mb-10 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[2.5rem] bg-primary/5 border border-primary/10 shadow-inner">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">
              {step === "create" ? "Create PIN" : step === "confirm" ? "Confirm PIN" : "Setup Complete"}
            </h1>
            <p className="mt-2 text-sm font-bold text-muted-foreground">
              {step === "create" 
                ? "Create a secure 4-6 digit PIN for parent access" 
                : step === "confirm" 
                ? "Enter your PIN again to confirm" 
                : "Your PIN has been set up successfully"}
            </p>
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-center"
              >
                <div className="flex items-center justify-center gap-2 text-sm font-bold text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* PIN Setup Form */}
          {step !== "success" && (
            <form onSubmit={step === "create" ? handleCreateSubmit : handleConfirmSubmit} className="space-y-10">
              <div>
                {renderPinInputs(step === "create" ? pin : confirmPin, step === "create" ? createInputRefs : confirmInputRefs, step === "confirm")}
              </div>

              <div className="space-y-6">
                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isSubmitting}
                  className="group relative h-16 w-full overflow-hidden rounded-3xl bg-primary text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-primary/20 transition-all hover:bg-primary/90 disabled:opacity-30 disabled:grayscale"
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                      <span>Setting up...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      {step === "create" ? (
                        <>
                          <span>Continue</span>
                          <ArrowRight className="h-5 w-5" />
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-5 w-5" />
                          <span>Complete Setup</span>
                        </>
                      )}
                    </div>
                  )}
                </motion.button>

                <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                  <AlertCircle className="h-3 w-3" />
                  <span>Secure PIN Required for Parent Access</span>
                </div>
              </div>
            </form>
          )}

          {/* Success State */}
          {step === "success" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                <ShieldCheck className="h-10 w-10 text-green-600" />
              </div>
              <p className="text-sm font-bold text-muted-foreground">
                Redirecting to dashboard...
              </p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
