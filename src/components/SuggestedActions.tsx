import { motion } from "framer-motion";
import { getCurrentModeConfig } from "@/lib/modeEngine";

interface SuggestedActionsProps {
  onSelect: (action: string, intent?: string) => void;
}

const SuggestedActions = ({ onSelect }: SuggestedActionsProps) => {
  const config = getCurrentModeConfig();
  const colors = [
    "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100",
    "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100",
    "bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-100",
    "bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100",
  ];

  const handleSelect = (suggestion: string) => {
    const cleanText = suggestion.replace(/\s*[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*/gu, "").trim();
    const lowerText = cleanText.toLowerCase();
    
    let intent = "general";
    let contextualPrompt = cleanText;

    if (lowerText.includes("joke")) {
      intent = "joke";
      contextualPrompt = `Tell me a fresh joke considering our previous conversation. If you already told one, make this one completely different!`;
    } else if (lowerText.includes("story")) {
      intent = "story";
      contextualPrompt = `Tell me a short, engaging story. Use our past conversation for inspiration, but make it a brand new adventure!`;
    } else if (lowerText.includes("quiz")) {
      intent = "quiz";
      contextualPrompt = "Quiz me on something we've been talking about!";
    } else if (lowerText.includes("fact")) {
      intent = "fact";
      contextualPrompt = "Tell me an amazing new fact that I haven't heard yet!";
    } else if (lowerText.includes("explain")) {
      intent = "explanation";
      contextualPrompt = "Can you explain something new to me based on what we've been learning?";
    }

    onSelect(contextualPrompt, intent);
  };

  return (
    <div className="w-full py-2">
      <div className="flex flex-row flex-wrap justify-center gap-3 px-4">
        {config.suggestions.map((suggestion, i) => (
          <motion.button
            key={suggestion}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + i * 0.08 }}
            whileHover={{ scale: 1.05, y: -2, rotate: i % 2 === 0 ? 1 : -1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSelect(suggestion)}
            className={`rounded-2xl border px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all shadow-sm hover:shadow-soft ${colors[i % colors.length]}`}
          >
            {suggestion}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default SuggestedActions;
