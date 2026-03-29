import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import WelcomeHeader from "@/components/WelcomeHeader";
import ChatBubble from "@/components/ChatBubble";
import SuggestedActions from "@/components/SuggestedActions";
import ChatInput from "@/components/ChatInput";
import { askGroq } from "@/lib/groq";
import { detectRiskyMessage, rewriteUnsafe, analyzeEarlyRisk } from "@/lib/safety";
import { createAlert, createEarlyWarningAlert } from "@/lib/alerts/alertService";
import { generateQuiz } from "@/lib/intelligence/quiz";
import avatarImg from "@/assets/ai-buddy.png";
import { analyzeResponse } from "@/lib/transparency";
import { getPolicy } from "@/lib/policy";
import { analyzeMessages, saveIntelligenceMetrics } from "@/lib/intelligence";
import { saveActivity, getCategory } from "@/lib/activity";
import { isAppBlocked, addUsageSession } from "@/lib/screen-time";
import { getMode as getInterventionMode, trackAndAutoReset, getInterventionRemainingTime } from "@/lib/intervention/modeService";
import { addMessageToActiveInterventions } from "@/lib/intervention/interventionService";
import { getCurrentMode, getCurrentModeConfig, setCurrentMode, isStrictModeEnabled, getModeRemainingTime, getStrictModeRemainingTime } from "@/lib/modeEngine";
import { Lock, Timer, Heart, ShieldAlert, Hourglass } from "lucide-react";
import { AIMode } from "@/lib/modes";
import { InteractionContext } from "@/types";
import { getConfig } from "@/lib/configStore";

interface Message {
  text: string;
  isAI: boolean;
  isBlocked?: boolean; // Indicates if message was blocked by safety filter
  meta?: { // Transparency metadata
    status: "safe" | "filtered" | "guided";
    reason: string;
  };
}

interface AIResponse {
  text: string;
  isAI: true;
  isBlocked?: boolean;
  meta?: {
    status: "safe" | "filtered" | "guided";
    reason: string;
  };
}

import { getMessages, clearConversation } from "@/lib/conversationStore";
import { addRecentTopic, getIntentState, setActiveQuiz } from "@/lib/intentStore";

const Index = () => {
  const config = getConfig();
  
  const defaultGreeting: Message = {
    text: config.ai.defaultGreeting,
    isAI: true,
  };

  const [messages, setMessages] = useState<Message[]>(() => {
    const history = getMessages();
    if (history.length === 0) return [defaultGreeting];
    return history.map(m => ({
      text: m.content,
      isAI: m.role === "assistant"
    }));
  });
  const [aiMode, setAiMode] = useState<AIMode>(getCurrentMode());
  const [remainingTime, setRemainingTime] = useState<number>(getModeRemainingTime());
  const [strictRemaining, setStrictRemaining] = useState<number>(getStrictModeRemainingTime());
  const [interventionRemaining, setInterventionRemaining] = useState<number>(getInterventionRemainingTime());
  const [isLoading, setIsLoading] = useState(false);
  const [blockStatus, setBlockStatus] = useState(isAppBlocked());
  const [interactionContext, setInteractionContext] = useState<InteractionContext>({ type: null });
  const navigate = useNavigate();
  const chatRef = useRef<HTMLDivElement>(null);
  const sessionStartRef = useRef<number>(Date.now());

  // Mode state and toast
  const [toast, setToast] = useState<{ message: string; type: "info" | "success" } | null>(null);

  const handleModeChange = (newMode: AIMode) => {
    setCurrentMode(newMode);
    setAiMode(newMode);
    setRemainingTime(getModeRemainingTime());
    setToast({ 
      message: `Switched to ${getCurrentModeConfig().label}`, 
      type: "success" 
    });
    setTimeout(() => setToast(null), 3000);
  };

  // Update block status and remaining time periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setBlockStatus(isAppBlocked());
      
      const currentMode = getCurrentMode();
      if (currentMode !== aiMode) {
        setAiMode(currentMode);
      }
      setRemainingTime(getModeRemainingTime());
      setStrictRemaining(getStrictModeRemainingTime());
      setInterventionRemaining(getInterventionRemainingTime());
    }, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [aiMode]);

  // Format remaining time for UI
  const formatRemainingTime = (ms: number) => {
    const mins = Math.ceil(ms / 60000);
    return `${mins}m`;
  };

  // Track session on unmount or beforeunload
  useEffect(() => {
    const trackSession = () => {
      const end = Date.now();
      const start = sessionStartRef.current;
      // Only track if session was longer than 5 seconds
      if (end - start > 5000) {
        addUsageSession(start, end);
      }
    };

    window.addEventListener("beforeunload", trackSession);
    return () => {
      trackSession();
      window.removeEventListener("beforeunload", trackSession);
    };
  }, []);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (text: string, intent?: string) => {
    // Prevent empty messages
    if (!text.trim()) return;

    const userMsg: Message = { text, isAI: false };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // Layer 1: Semantic Risk Detection
    const risk = await detectRiskyMessage(text);
    
    // Create alert if high risk
    await createAlert(text, risk);

    // Predictive Risk Analysis (Async, non-blocking)
    const history = getMessages();
    analyzeEarlyRisk([...history, { role: "user", content: text }].map(m => ({ text: m.content, timestamp: Date.now() })))
      .then(earlyRisk => {
        if (earlyRisk.early_risk && earlyRisk.confidence > 70) {
          createEarlyWarningAlert(text, earlyRisk);
        }
      })
      .catch(err => console.error("[Chat] Early risk analysis failed:", err));

    // Analyze messages for intelligence metrics (Async)
    const intelligenceData = analyzeMessages([...history, { role: "user", content: text }].map(m => ({
      role: m.role as "user" | "assistant",
      text: m.content
    })));
    saveIntelligenceMetrics(intelligenceData);

    // Track for auto-reset of intervention mode
    trackAndAutoReset();
    
    // Track message for intervention outcome analysis
    addMessageToActiveInterventions(text);

    // --- Interaction Context Handling (DETERMINISTIC EVALUATION) ---
    const currentIntentState = getIntentState();
    const activeQuiz = currentIntentState.activeQuiz;
    const isStopCommand = /stop quiz|quit|exit|cancel quiz/i.test(text);

    if (activeQuiz) {
      if (isStopCommand) {
        setActiveQuiz(null);
        setMessages((prev) => [...prev, { text: "Okay! Let's do something else. What's on your mind? 😊", isAI: true }]);
        setIsLoading(false);
        return;
      }

      const normalizedInput = text.trim().toUpperCase();
      const options = activeQuiz.options;
      
      // 1. Direct letter match (A, B, C, D)
      let matchedLabel: "A" | "B" | "C" | "D" | null = null;
      if (/^[A-D]$/.test(normalizedInput)) {
        matchedLabel = normalizedInput as "A" | "B" | "C" | "D";
      } else {
        // 2. Text match (check if user typed the option text)
        const entries = Object.entries(options) as [("A" | "B" | "C" | "D"), string][];
        const match = entries.find(([_, value]) => 
          normalizedInput.includes(value.toUpperCase()) || 
          value.toUpperCase().includes(normalizedInput)
        );
        if (match) matchedLabel = match[0];
      }

      if (matchedLabel) {
        const isCorrect = matchedLabel === activeQuiz.correctAnswer;
        
        // Use AI ONLY for tone and personalized feedback after we determine correctness
        const feedbackPrompt = `The user answered "${text}" which corresponds to option ${matchedLabel} ("${options[matchedLabel]}").
        The question was: "${activeQuiz.question}".
        This is ${isCorrect ? 'CORRECT' : 'INCORRECT'}. 
        The true correct answer was ${activeQuiz.correctAnswer}: ${options[activeQuiz.correctAnswer]}.
        EXPLANATION: ${activeQuiz.explanation}.
        
        STRICT RULES:
        1. Confirm if they were right or wrong clearly but kindly.
        2. Use the provided EXPLANATION to teach them.
        3. Keep the tone fun and encouraging.
        4. Do NOT ask another quiz question yet.`;
        
        const aiText = await askGroq(feedbackPrompt, "quiz");
        
        if (aiText) {
          setMessages((prev) => [...prev, { text: aiText, isAI: true, meta: { status: "safe", reason: "Quiz Feedback" } }]);
        }
        
        setActiveQuiz(null); // Clear quiz state after answer
        setIsLoading(false);
        return;
      } else {
        // Mode Consistency: User didn't give a clear answer, so prompt them again
        const fallbackPrompt = `The child said "${text}" but I'm waiting for an answer to this quiz: "${activeQuiz.question}". 
        Options are: A: ${options.A}, B: ${options.B}, C: ${options.C}, D: ${options.D}.
        Kindly remind them to pick one of the options (A, B, C, or D) or say "stop quiz" to quit.`;
        
        const aiText = await askGroq(fallbackPrompt, "quiz");
        if (aiText) {
          setMessages((prev) => [...prev, { text: aiText, isAI: true }]);
        }
        setIsLoading(false);
        return;
      }
    }

    if (text.toLowerCase().includes("quiz me")) {
      setIsLoading(true);
      const quiz = await generateQuiz();
      
      if (quiz) {
        // Save structured state
        setActiveQuiz(quiz);

        const optionsText = Object.entries(quiz.options).map(([k, v]) => `${k}: ${v}`).join("\n");
        const quizPrompt = `Ask this quiz question to the child: "${quiz.question}". 
        OPTIONS:
        ${optionsText}
        Make it sound exciting and friendly.`;
        
        const aiText = await askGroq(quizPrompt, "quiz");
        
        if (aiText) {
          setMessages((prev) => [
            ...prev, 
            { 
              text: aiText, 
              isAI: true, 
              meta: { status: "safe", reason: "Structured Quiz Generation" } 
            }
          ]);
        }
        
        setIsLoading(false);
        return;
      }
    }
    // ------------------------------------

    if (risk.is_flagged) {
      setTimeout(() => {
        const safeResponse: AIResponse = {
          text: rewriteUnsafe(text),
          isAI: true,
          isBlocked: true,
          meta: {
            status: "filtered",
            reason: risk.reason,
          },
        };
        setMessages((prev) => [...prev, safeResponse]);
        
        // Manual logging for blocked messages (since askGroq is bypassed)
        saveActivity({
          userText: text,
          aiText: safeResponse.text,
          category: getCategory(text),
          timestamp: Date.now(),
          status: "filtered",
          risk: risk,
        });
        
        setIsLoading(false);
      }, 600);
      return;
    }

    // Layer 2: Call Groq API (now includes global history and logging)
    try {
      const aiText = await askGroq(text, intent);
      
      if (aiText) {
        // Track recent topics for anti-repetition (simple extraction)
        if (intent === "joke") addRecentTopic("joke");
        if (intent === "story") addRecentTopic("story");
        if (text.length > 3 && text.length < 20) addRecentTopic(text.toLowerCase());

        const policy = getPolicy();
        const meta = analyzeResponse(text, aiText, policy);
        
        setMessages((prev) => [
          ...prev,
          {
            text: aiText,
            isAI: true,
            meta: meta,
          },
        ]);
      } else {
        // Fallback logic
        const fallbackText = "I'm having a little trouble thinking right now. Let's try again in a moment! 😊";
        setMessages((prev) => [...prev, { text: fallbackText, isAI: true }]);
      }
    } catch (error) {
      console.error("[Chat] Error getting AI response:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update mode from intervention mode service
  const currentInterventionMode = getInterventionMode();

  return (
    <div className="flex h-screen w-full flex-col bg-background selection:bg-primary/20 selection:text-primary overflow-hidden">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 20 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-0 left-1/2 z-[100] -translate-x-1/2"
          >
            <div className={`rounded-full px-6 py-2 text-xs font-black uppercase tracking-widest shadow-xl border ${
              toast.type === "success" ? "bg-primary text-white border-primary/20" : "bg-white text-foreground border-border"
            }`}>
              {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decorative background shapes */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/5 animate-pulse blur-3xl" />
        <div className="absolute top-1/4 -left-32 h-80 w-80 rounded-full bg-secondary/10 animate-pulse blur-3xl" style={{ animationDelay: "2s" }} />
        <div className="absolute -bottom-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-accent/5 animate-pulse blur-3xl" style={{ animationDelay: "4s" }} />
      </div>

      <WelcomeHeader
        childName="Alex"
        mode={aiMode === "fun" ? "fun" : "learn"}
        onToggleMode={() => handleModeChange(aiMode === "fun" ? "learning" : "fun")}
      />

      {/* Mode indicator */}
      <div className="mx-auto mb-4 flex flex-wrap justify-center gap-3 z-10 pt-4">
        <motion.div
          key={aiMode}
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
        >
          <button
            onClick={() => {
              const modes: AIMode[] = ["learning", "fun", "exploration", "focus"];
              const nextIndex = (modes.indexOf(aiMode) + 1) % modes.length;
              handleModeChange(modes[nextIndex]);
            }}
            className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2 text-xs font-black uppercase tracking-widest shadow-soft border transition-all ${
              aiMode === "learning"
                ? "bg-white text-primary border-primary/20"
                : "bg-white text-accent-foreground border-accent/20"
            }`}
          >
            <div className={`h-2 w-2 rounded-full animate-pulse ${aiMode === "learning" ? "bg-primary" : "bg-accent"}`} />
            Mode: {getCurrentModeConfig().label} {getCurrentModeConfig().icon}
            {aiMode !== "learning" && remainingTime > 0 && (
              <span className="ml-2 pl-2 border-l border-muted/20 text-muted-foreground flex items-center gap-1">
                <Hourglass className="h-2.5 w-2.5 animate-spin-slow" />
                {formatRemainingTime(remainingTime)}
              </span>
            )}
          </button>
        </motion.div>

        {currentInterventionMode !== "normal" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            className="z-10"
          >
            <span className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2 text-xs font-black uppercase tracking-widest shadow-soft border transition-all ${
              currentInterventionMode === "support"
                ? "bg-orange-50 text-orange-700 border-orange-200"
                : "bg-destructive/5 text-destructive border-destructive/20"
            }`}>
              {currentInterventionMode === "support" ? <Heart className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
              {currentInterventionMode === "support" ? "Support Mode" : "Strict Mode"}
              {interventionRemaining > 0 && (
                <span className="ml-2 pl-2 border-l border-current/20 flex items-center gap-1 opacity-70">
                  <Hourglass className="h-2.5 w-2.5 animate-spin-slow" />
                  {formatRemainingTime(interventionRemaining)}
                </span>
              )}
            </span>
          </motion.div>
        )}

        {isStrictModeEnabled() && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: -20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
          >
            <span className="inline-flex items-center gap-2 rounded-2xl px-5 py-2 text-xs font-black uppercase tracking-widest shadow-soft border bg-red-50 text-red-700 border-red-200">
              <Shield className="h-3 w-3" />
              Parental Strict Mode
              {strictRemaining > 0 && (
                <span className="ml-2 pl-2 border-l border-red-200 flex items-center gap-1 opacity-70">
                  <Hourglass className="h-2.5 w-2.5 animate-spin-slow" />
                  {formatRemainingTime(strictRemaining)}
                </span>
              )}
            </span>
          </motion.div>
        )}
      </div>

      {/* Chat Area - Full Width with expanded message constraint */}
      <div
        ref={chatRef}
        className="relative flex-1 overflow-y-auto px-8 py-6 scroll-smooth no-scrollbar"
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          {messages.map((msg, index) => (
             <ChatBubble
               key={index}
               message={msg.text}
               isAI={msg.isAI}
               index={index}
               isBlocked={msg.isBlocked}
               meta={msg.meta}
             />
           ))}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-4"
            >
              <div className="h-10 w-10 flex-shrink-0 animate-bounce">
                <img src={avatarImg} alt="AI Buddy" className="h-full w-full object-contain" />
              </div>
              <div className="flex items-center gap-1.5 rounded-3xl bg-white px-6 py-4 shadow-card border border-primary/5">
                <div className="h-2 w-2 animate-bounce rounded-full bg-primary/40" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-primary/60" style={{ animationDelay: "0.2s" }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-primary/80" style={{ animationDelay: "0.4s" }} />
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Bottom control area - Suggestions + Input */}
      <div className="relative z-20 w-full border-t border-primary/5 bg-white/60 p-6 pb-10 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl w-full space-y-6">
          {blockStatus.blocked ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="mx-auto w-full rounded-3xl bg-destructive/5 p-8 text-center border border-destructive/20 shadow-soft"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-destructive/10 text-destructive">
                {blockStatus.reason?.includes("locked") ? (
                  <Lock className="h-8 w-8" />
                ) : (
                  <Timer className="h-8 w-8" />
                )}
              </div>
              <h3 className="text-xl font-black text-foreground uppercase tracking-tight">
                {blockStatus.reason || "Time for a break!"}
              </h3>
              <p className="mt-2 text-sm font-medium text-muted-foreground leading-relaxed max-w-md mx-auto">
                {blockStatus.reason?.includes("limit") 
                  ? "You've reached your daily learning limit! Take a break and come back tomorrow. 🌟" 
                  : "The app has been locked by your parent for now. Go ask them for more time! 😊"}
              </p>
            </motion.div>
          ) : (
            <div className="w-full space-y-6">
              <SuggestedActions onSelect={handleSend} />
              <ChatInput onSend={handleSend} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
