import { motion } from "framer-motion";
import avatarImg from "@/assets/ai-buddy.png";

interface ChatBubbleProps {
  message: string;
  isAI: boolean;
  index: number;
  isBlocked?: boolean; // Indicates if message was blocked by safety filter
  meta?: { // Transparency metadata
    status: "safe" | "filtered" | "guided";
    reason: string;
  };
}

const ChatBubble = ({ message, isAI, index, isBlocked, meta }: ChatBubbleProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.1, type: "spring", stiffness: 200 }}
      className={`flex gap-2.5 ${isAI ? "justify-start" : "justify-end"}`}
    >
      {isAI && (
        <div className="mt-1 h-8 w-8 flex-shrink-0 rounded-full gradient-hero p-0.5">
          <img src={avatarImg} alt="AI" className="h-full w-full rounded-full bg-card object-cover" />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-[2rem] px-6 py-4 text-[15px] font-medium leading-relaxed shadow-card border transition-all hover:shadow-soft ${
          isAI
            ? "rounded-tl-lg bg-white text-foreground border-primary/5"
            : "rounded-tr-lg gradient-hero text-white border-primary/10"
        }`}
      >
        {/* Safety indicator for blocked messages */}
        {isBlocked && isAI && (
          <div className="mb-2 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-accent-foreground border border-accent/20">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Safety Guard Active
            </span>
          </div>
        )}
        
        {/* Transparency indicator for AI responses */}
        {isAI && meta && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest border ${
                meta.status === "safe"
                  ? "bg-primary/10 text-primary border-primary/20"
                  : meta.status === "filtered"
                  ? "bg-accent/10 text-accent-foreground border-accent/20"
                  : "bg-secondary/10 text-secondary border-secondary/20"
              }`}
            >
              {meta.status === "safe" ? "✓" : meta.status === "filtered" ? "⚠" : "📋"}
              {meta.status}
            </span>
            <span className="text-[11px] font-bold text-muted-foreground italic">{meta.reason}</span>
          </div>
        )}
        
        <p className="whitespace-pre-wrap">{message}</p>
      </div>
    </motion.div>
  );
};

export default ChatBubble;
