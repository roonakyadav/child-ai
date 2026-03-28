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
import { getMode as getInterventionMode, trackAndAutoReset } from "@/lib/intervention/modeService";
import { addMessageToActiveInterventions } from "@/lib/intervention/interventionService";
import { getCurrentMode, getCurrentModeConfig, setCurrentMode, isStrictModeEnabled } from "@/lib/modeEngine";
import { Lock, Timer, Heart, ShieldAlert } from "lucide-react";
import { AIMode } from "@/lib/modes";
import { InteractionContext } from "@/types";

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

const aiResponses: Record<string, string> = {
  "Help me with homework": "Great choice! 📚 What subject are you working on? I can help with math, science, reading, and more. Let's figure it out together!",
  "Tell me a story": "Once upon a time, in a forest made of candy… 🍬 A brave little fox named Pixel discovered a hidden library inside a giant mushroom. Want me to continue? 📖",
  "Explain something": "I love explaining things! 🧠 Pick a topic — like why the sky is blue, how volcanoes work, or what makes rainbows — and I'll break it down for you!",
  "Fun facts": "Did you know? 🎉 Octopuses have THREE hearts and BLUE blood! Two hearts pump blood to their gills, and one pumps it to the rest of the body. How cool is that?",
};

const defaultGreeting: Message = {
  text: "Hey there! 🌟 I'm so happy to see you! What would you like to explore today? You can pick one of the buttons below, or ask me anything!",
  isAI: true,
};

const Index = () => {
  const [messages, setMessages] = useState<Message[]>([defaultGreeting]);
  const [aiMode, setAiMode] = useState<AIMode>(getCurrentMode());
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
    setToast({ 
      message: `Switched to ${getCurrentModeConfig().label}`, 
      type: "success" 
    });
    setTimeout(() => setToast(null), 3000);
  };

  // Update block status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setBlockStatus(isAppBlocked());
    }, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

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

  const handleSend = async (text: string) => {
    // Prevent empty messages
    if (!text.trim()) return;

    const userMsg: Message = { text, isAI: false };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // Analyze messages for intelligence metrics after each new message
    const allMessages = [...messages, userMsg];
    const intelligenceData = analyzeMessages(
      allMessages.map(m => ({
        role: m.isAI ? "assistant" : "user",
        text: m.text,
      }))
    );
    saveIntelligenceMetrics(intelligenceData);

    // Layer 1: Semantic Risk Detection
    const risk = await detectRiskyMessage(text);
    
    // Create alert if high risk
    await createAlert(text, risk);

    // Predictive Risk Analysis (Async, non-blocking)
    analyzeEarlyRisk(allMessages.map(m => ({ text: m.text, timestamp: Date.now() })))
      .then(earlyRisk => {
        if (earlyRisk.early_risk && earlyRisk.confidence > 70) {
          createEarlyWarningAlert(text, earlyRisk);
        }
      })
      .catch(err => console.error("[Chat] Early risk analysis failed:", err));

    // Track for auto-reset of intervention mode
    trackAndAutoReset();
    
    // Track message for intervention outcome analysis
    addMessageToActiveInterventions(text);

    // --- Interaction Context Handling ---
    if (interactionContext.type === "quiz" && interactionContext.quiz) {
      const normalizedInput = text.trim().toUpperCase();
      const isShortAnswer = normalizedInput.length === 1 && /^[A-D]$/.test(normalizedInput);
      
      if (isShortAnswer) {
        const isCorrect = normalizedInput === interactionContext.quiz.correct_answer.toUpperCase();
        const responseText = isCorrect 
          ? `🌟 **Spot on!** "${normalizedInput}" is the correct answer. You're doing amazing! Keep it up! 🚀`
          : `😊 **Close!** The correct answer was actually **${interactionContext.quiz.correct_answer}**. But don't worry, every mistake is just a step towards learning something new! Want to try another one? ✨`;
        
        setMessages((prev) => [...prev, { text: responseText, isAI: true, meta: { status: "safe", reason: "Deterministic Quiz Evaluation" } }]);
        setInteractionContext({ type: null }); // Reset context
        setIsLoading(false);
        return;
      }
    }

    if (text.toLowerCase().includes("quiz me")) {
      // Step 1: Start loading and generate structured quiz
      setIsLoading(true);
      const quiz = await generateQuiz();
      
      if (quiz) {
        const quizText = `${quiz.question}\n\n${quiz.options.map(o => `**${o.label}**: ${o.text}`).join("\n")}`;
        
        setMessages((prev) => [
          ...prev, 
          { 
            text: quizText, 
            isAI: true, 
            meta: { status: "safe", reason: "Structured Quiz Generation" } 
          }
        ]);
        
        setInteractionContext({
          type: "quiz",
          quiz: quiz,
        });
        
        setIsLoading(false);
        return; // Important: Don't fall through to generic AI response
      }
    }
    // ------------------------------------

    if (risk.is_flagged) {
      setTimeout(() => {
        const safeResponse: AIResponse = {
          text: rewriteUnsafe(text),
          isAI: true,
          isBlocked: true, // Mark as blocked by safety filter
          meta: {
            status: "filtered",
            reason: risk.reason,
          },
        };
        setMessages((prev) => [...prev, safeResponse]);
        
        // Save activity with filtered status and risk data
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

    // Layer 2: Call Groq API with system prompt for child-safe responses
    try {
      const aiText = await askGroq(text);
      
      if (aiText) {
        // Analyze response for transparency
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
        
        // Save activity with real meta status and risk data (even if safe)
        saveActivity({
          userText: text,
          aiText: aiText,
          category: getCategory(text),
          timestamp: Date.now(),
          status: meta.status,
          risk: risk,
        });
      } else {
        // Layer 3: Fallback to mock response if API fails
        const fallbackText =
          aiMode === "fun"
            ? `That's an awesome question! 🎮 Here's a fun way to think about "${text}" — imagine you're a scientist exploring a brand new planet... What would you discover? 🚀`
            : `Great question about "${text}"! 🤔 Let me help you think about it step by step. What do you already know about this topic? That's always the best place to start! ✨`;
        
        // Analyze fallback response too
        const policy = getPolicy();
        const meta = analyzeResponse(text, fallbackText, policy);
        
        setMessages((prev) => [
          ...prev,
          {
            text: fallbackText,
            isAI: true,
            meta: meta,
          },
        ]);
        
        // Save activity with fallback and risk data
        saveActivity({
          userText: text,
          aiText: fallbackText,
          category: getCategory(text),
          timestamp: Date.now(),
          status: meta.status,
          risk: risk,
        });
      }
    } catch (error) {
      console.error("[Chat] Error getting AI response:", error);
      // Layer 3: Fallback to mock response on error
      const fallbackText =
        aiMode === "fun"
          ? `That's an awesome question! 🎮 Here's a fun way to think about "${text}" — imagine you're a scientist exploring a brand new planet... What would you discover? 🚀`
          : `Great question about "${text}"! 🤔 Let me help you think about it step by step. What do you already know about this topic? That's always the best place to start! ✨`;
      
      // Analyze fallback response
      const policy = getPolicy();
      const meta = analyzeResponse(text, fallbackText, policy);
      
      setMessages((prev) => [
        ...prev,
        {
          text: fallbackText,
          isAI: true,
          meta: meta,
        },
      ]);
      
      // Save activity with fallback and risk data
      saveActivity({
        userText: text,
        aiText: fallbackText,
        category: getCategory(text),
        timestamp: Date.now(),
        status: meta.status,
        risk: risk,
      });
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
              {currentInterventionMode === "support" ? "Support Mode Active" : "Strict Mode Active"}
            </span>
          </motion.div>
        )}

        {isStrictModeEnabled() && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: -20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            className="z-10"
          >
            <span className="inline-flex items-center gap-2 rounded-2xl px-5 py-2 text-xs font-black uppercase tracking-widest shadow-soft border bg-destructive text-white border-destructive/20">
              <ShieldAlert className="h-3 w-3" />
              Global Strict Mode
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
