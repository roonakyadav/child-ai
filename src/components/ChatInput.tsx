import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Mic } from "lucide-react";
import { useVoice } from "@/hooks/useVoice";

interface ChatInputProps {
  onSend: (message: string) => void;
}

const ChatInput = ({ onSend }: ChatInputProps) => {
  const [value, setValue] = useState("");
  const { transcript, isListening, startListening, stopListening, resetTranscript } = useVoice();

  // Update input value when transcript changes
  useEffect(() => {
    if (transcript) {
      setValue(transcript);
    }
  }, [transcript]);

  const handleSend = () => {
    if (!value.trim()) return;
    onSend(value.trim());
    setValue("");
    resetTranscript();
  };

  const toggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.4 }}
      className="flex w-full items-center gap-3 px-4"
    >
      <div className="relative flex-1 group">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask me anything..."
          className="w-full rounded-[2rem] border border-primary/10 bg-white px-8 py-5 text-[15px] font-bold text-foreground placeholder:text-muted-foreground/60 shadow-card outline-none ring-primary/20 focus:ring-4 transition-all group-hover:border-primary/20 group-hover:shadow-soft"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.1, rotate: isListening ? 0 : 5 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleVoice}
            className={`flex h-10 w-10 items-center justify-center rounded-2xl transition-all ${
              isListening 
                ? "bg-destructive text-white shadow-soft" 
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-primary"
            }`}
          >
            <Mic className={`h-5 w-5 ${isListening ? "animate-pulse" : ""}`} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1, x: 2 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleSend}
            disabled={!value.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-2xl gradient-hero text-white shadow-soft transition-all hover:shadow-glow disabled:opacity-30 disabled:grayscale"
          >
            <Send className="h-4 w-4" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default ChatInput;
