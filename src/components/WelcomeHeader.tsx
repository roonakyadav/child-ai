import { motion } from "framer-motion";
import { Shield, Sparkles, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import avatarImg from "@/assets/ai-buddy.png";
import { getChildStats } from "@/lib/activity";

interface WelcomeHeaderProps {
  childName: string;
  mode: "learn" | "fun";
  onToggleMode: () => void;
}

const WelcomeHeader = ({ childName, mode, onToggleMode }: WelcomeHeaderProps) => {
  const navigate = useNavigate();
  const stats = getChildStats();

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="flex items-center justify-between px-6 py-6 sm:px-8 bg-white/40 backdrop-blur-md sticky top-0 z-50 border-b border-primary/5"
    >
      {/* Left: Avatar + Greeting + Stats */}
      <div className="flex items-center gap-6">
        <motion.div
          className="h-14 w-14 rounded-3xl gradient-hero p-1 shadow-soft overflow-hidden"
          animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 0.95, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <img
            src={avatarImg}
            alt="AI Buddy avatar"
            className="h-full w-full rounded-2xl bg-white object-contain"
          />
        </motion.div>
        
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70">Welcome back!</span>
            <span className="h-1 w-1 rounded-full bg-primary/20" />
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-accent/10 text-accent text-[9px] font-black uppercase tracking-widest border border-accent/10">
              <Star className="h-2.5 w-2.5 fill-current" />
              Level {stats.level}
            </div>
          </div>
          <h1 className="text-xl font-black text-foreground leading-tight tracking-tight">
            Hey {childName}! 👋
          </h1>
        </div>

        {/* XP Bar */}
        <div className="hidden lg:flex flex-col gap-1.5 w-48">
          <div className="flex items-center justify-between px-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70 flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5 text-accent" />
              Next Level
            </span>
            <span className="text-[9px] font-black text-muted-foreground/70">{Math.round((stats.xp / stats.nextLevelXp) * 100)}%</span>
          </div>
          <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden border border-muted-foreground/5 p-0.5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(stats.xp / stats.nextLevelXp) * 100}%` }}
              className="h-full rounded-full gradient-hero"
            />
          </div>
        </div>
      </div>

      {/* Right: Parent Dashboard + Mode Toggle */}
      <div className="flex items-center gap-4">
        {/* Parent Dashboard Button */}
        <motion.button
          onClick={() => navigate("/parent")}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 rounded-2xl bg-muted/50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted hover:text-foreground transition-all border border-transparent hover:border-muted-foreground/10 shadow-soft"
        >
          <Shield className="h-4 w-4" />
          Parents Dashboard
        </motion.button>

        {/* Mode Toggle */}
        <motion.button
          onClick={onToggleMode}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`relative flex items-center gap-2 rounded-2xl px-5 py-2 text-[11px] font-black uppercase tracking-widest transition-all shadow-soft border ${
            mode === "fun"
              ? "bg-accent text-accent-foreground border-accent/20"
              : "gradient-hero text-white border-primary/20"
          }`}
        >
          {mode === "learn" ? "🧠 Learning" : "🎨 Fun Mode"}
        </motion.button>
      </div>
    </motion.header>
  );
};

export default WelcomeHeader;
