import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ShieldCheck, AlertCircle } from "lucide-react";
import { verifyPin } from "@/lib/auth";

export default function PinEntry() {
  const [pin, setPin] = useState(["", "", "", ""]);
  const [error, setError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Auto-focus first box on mount
  useEffect(() => {
    inputRefs[0].current?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);

    // Move to next box if value entered
    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const pinString = pin.join("");
    if (pinString.length !== 4) return;

    setIsSubmitting(true);
    const isValid = await verifyPin(pinString);
    
    if (isValid) {
      localStorage.setItem("parent_authenticated", "true");
      localStorage.setItem("parent_auth_time", Date.now().toString());
      navigate("/parent-dashboard/overview");
    } else {
      setError(true);
      setIsSubmitting(false);
      // Shake animation effect
      setTimeout(() => {
        setError(false);
        setPin(["", "", "", ""]);
        inputRefs[0].current?.focus();
      }, 600);
    }
  };

  // Auto-submit when 4th digit is entered
  useEffect(() => {
    if (pin.every(digit => digit !== "")) {
      handleSubmit();
    }
  }, [pin]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f8faff] selection:bg-primary/20">
      {/* STEP 1 & 2: LIGHT THEME + BACKGROUND BLUR/DIM */}
      <div className="absolute inset-0 z-0">
        {/* The underlying app background pattern (circles) for continuity */}
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-1/4 -left-32 h-80 w-80 rounded-full bg-secondary/15 blur-3xl" />
        
        {/* Subtle dimming and strong blur to create the overlay effect */}
        <div className="absolute inset-0 bg-white/10 backdrop-blur-md" />
        <div className="absolute inset-0 bg-black/5" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ 
          opacity: 1, 
          scale: 1, 
          y: 0,
          x: error ? [0, -10, 10, -10, 10, 0] : 0
        }}
        transition={{ 
          duration: 0.3,
          x: { duration: 0.4, ease: "easeInOut" }
        }}
        className="relative z-10 w-full max-w-[420px] px-6"
      >
        {/* STEP 3: CENTER CARD (LIGHT / SOFT GREEN) */}
        <div className="overflow-hidden rounded-[40px] border border-white bg-white/90 p-10 shadow-2xl shadow-primary/10 backdrop-blur-xl">
          
          {/* STEP 4: SECURITY FEEL (SUBTLE / SAME PALETTE) */}
          <div className="mb-10 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[2.5rem] bg-primary/5 border border-primary/10 shadow-inner">
              <Lock className={`h-8 w-8 transition-colors duration-300 ${error ? "text-destructive" : "text-primary"}`} />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">Parent Access</h1>
            <p className="mt-2 text-sm font-bold text-muted-foreground">
              {error ? "Incorrect PIN, please try again" : "Enter your secure code to continue"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-10">
            {/* STEP 5: PIN INPUT (CLEAN / GREEN FOCUS) */}
            <div className="flex justify-between gap-4">
              {pin.map((digit, index) => (
                <input
                  key={index}
                  ref={inputRefs[index]}
                  type="password"
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  maxLength={1}
                  className={`h-16 w-14 rounded-2xl border text-center text-2xl font-black outline-none transition-all duration-200 ${
                    error 
                      ? "border-destructive bg-destructive/5 text-destructive shadow-[0_0_15px_rgba(239,68,68,0.1)]" 
                      : "border-primary/10 bg-primary/5 text-primary focus:border-primary focus:ring-8 focus:ring-primary/10"
                  }`}
                  autoComplete="off"
                />
              ))}
            </div>

            <div className="space-y-6">
              {/* STEP 6: PRIMARY GREEN BUTTON */}
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                disabled={isSubmitting || pin.join("").length !== 4}
                className="group relative h-16 w-full overflow-hidden rounded-3xl bg-primary text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-primary/20 transition-all hover:bg-primary/90 disabled:opacity-30 disabled:grayscale"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    <span>Verifying...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <ShieldCheck className="h-5 w-5" />
                    <span>Open Dashboard</span>
                  </div>
                )}
              </motion.button>

              <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                <AlertCircle className="h-3 w-3" />
                <span>Parental Authorization Required</span>
              </div>
            </div>
          </form>
        </div>

        {/* Clearly visible helper text */}
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-10 text-center text-[14px] font-black text-primary uppercase tracking-[0.2em] bg-white/80 py-4 rounded-[2rem] border border-primary/20 shadow-soft backdrop-blur-sm"
        >
          Default Gateway: <span className="text-primary underline underline-offset-4 decoration-4">1234</span>
        </motion.p>
      </motion.div>
    </div>
  );
}