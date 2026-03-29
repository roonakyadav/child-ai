import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { 
  Lock, 
  Unlock, 
  Clock, 
  Zap, 
  Brain, 
  ShieldCheck, 
  Info,
  Calendar,
  Activity,
  History,
  Scale
} from "lucide-react";
import { 
  getScreenTimeSettings, 
  setScreenTimeSettings, 
  getUsedMinutesToday, 
  getTodaySessions,
  ScreenTimeMode,
  UsageSession
} from "@/lib/screen-time";
import { getActivity } from "@/lib/activity";

const ScreenTimeControls = () => {
  const [settings, setLocalSettings] = useState(getScreenTimeSettings());
  const [usedMinutes, setUsedMinutes] = useState(getUsedMinutesToday());
  const activities = getActivity();

  // Update usage periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setUsedMinutes(getUsedMinutesToday());
    }, 10000); // every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const updateSettings = (updates: Partial<typeof settings>) => {
    const newSettings = { ...settings, ...updates };
    setLocalSettings(newSettings);
    setScreenTimeSettings(newSettings);
  };

  // Data-Driven Analytics for Screen Time
  const analytics = useMemo(() => {
    const sessions = getTodaySessions();
    const totalInteractions = activities.length;
    
    // Compute Avg Session Length (NEW)
    const sessionLengths = sessions.map(s => (s.end - s.start) / 60000);
    const avgSessionLength = sessionLengths.length > 0 
      ? Math.round(sessionLengths.reduce((a, b) => a + b, 0) / sessionLengths.length) 
      : 0;

    // Sessions per Day (NEW)
    const sessionsToday = sessions.length;

    // Peak Time Calculation (Re-use logic from UsageAnalytics but scoped here)
    const hours = new Array(24).fill(0);
    activities.forEach(a => {
      const hour = new Date(a.timestamp).getHours();
      hours[hour]++;
    });
    const maxHourCount = Math.max(...hours);
    const peakHour = hours.indexOf(maxHourCount);
    
    function formatTimeRange(hour: number): string {
      if (hour < 0) return "N/A";
      if (hour === 0) return "12–2 AM";
      if (hour < 12) return `${hour}–${hour + 2} AM`;
      if (hour === 12) return "12–2 PM";
      const pmHour = hour - 12;
      return `${pmHour}–${pmHour + 2} PM`;
    }
    const peakTimeRange = peakHour >= 0 ? formatTimeRange(peakHour) : "N/A";

    // Active Days (Last 7 days)
    const activeDaysSet = new Set();
    activities.forEach(a => {
      const date = new Date(a.timestamp).toDateString();
      activeDaysSet.add(date);
    });
    const activeDays = activeDaysSet.size;

    return {
      avgSessionLength,
      sessionsToday,
      peakTimeRange,
      peakHour,
      activeDays,
      totalInteractions
    };
  }, [activities]);

  // Smart Usage Insight Logic
  const smartInsight = useMemo(() => {
    if (analytics.totalInteractions === 0) return null;

    if (analytics.peakHour >= 17 && analytics.peakHour <= 21) {
      return {
        title: "Evening Usage Detected",
        description: `Usage is mostly concentrated between ${analytics.peakTimeRange}. Consider limiting late-day sessions to improve sleep hygiene.`,
        type: "warning"
      };
    }

    if (analytics.activeDays < 3 && analytics.totalInteractions > 10) {
      return {
        title: "Inconsistent Learning Pattern",
        description: "Usage is high but spread across very few days. Short daily sessions (15-20m) may improve long-term retention.",
        type: "info"
      };
    }

    if (analytics.avgSessionLength > 30) {
      return {
        title: "Long Sessions Detected",
        description: "Alex tends to spend more than 30 minutes in a single session. Short breaks are recommended to maintain focus.",
        type: "warning"
      };
    }

    return {
      title: "Healthy Usage Rhythm",
      description: "Alex is maintaining a balanced schedule of learning and interaction.",
      type: "success"
    };
  }, [analytics]);

  const remaining = Math.max(0, settings.dailyLimit - usedMinutes);
  const percentage = Math.min(100, Math.round((usedMinutes / settings.dailyLimit) * 100));

  // Circular progress color based on remaining time
  const progressColor = remaining <= 1 ? "stroke-destructive" : remaining <= 5 ? "stroke-orange-500" : "stroke-primary";

  return (
    <div className="space-y-8 pb-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Screen Time Controls</h1>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-1">Intelligent parenting control system</p>
        </div>
        
        {settings.isLocked && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive animate-pulse">
            <Lock className="h-4 w-4" />
            <span className="text-xs font-black uppercase tracking-widest">App Locked</span>
          </div>
        )}
      </header>

      {/* 1. Smart Usage Insight Card */}
      {smartInsight && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-[40px] p-8 border shadow-soft relative overflow-hidden group ${
            smartInsight.type === "warning" ? "bg-orange-50/50 border-orange-200/50" :
            smartInsight.type === "success" ? "bg-mint/5 border-mint/20" : "bg-primary/5 border-primary/20"
          }`}
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
            <Brain className="h-20 w-20" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className={`h-10 w-10 flex items-center justify-center rounded-2xl shadow-sm ${
                smartInsight.type === "warning" ? "bg-orange-100 text-orange-600" :
                smartInsight.type === "success" ? "bg-mint/10 text-mint" : "bg-primary/10 text-primary"
              }`}>
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Smart Usage Insight</h3>
                <h4 className="text-lg font-black text-foreground">{smartInsight.title}</h4>
              </div>
            </div>
            <p className="text-base font-bold text-foreground/80 leading-relaxed max-w-2xl">
              "{smartInsight.description}"
            </p>
          </div>
        </motion.div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* 2. Time Remaining Card */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-[40px] bg-white p-8 border border-white shadow-soft space-y-8 flex flex-col"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Clock className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-black text-foreground tracking-tight">Time Remaining</h3>
            </div>
            {remaining <= 5 && (
              <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest animate-bounce ${
                remaining <= 1 ? "bg-destructive text-white" : "bg-orange-500 text-white"
              }`}>
                {remaining <= 1 ? "Final Warning" : "Warning: 5m left"}
              </span>
            )}
          </div>

          <div className="relative mx-auto h-52 w-52 flex-1 flex items-center justify-center">
            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" stroke="hsl(var(--muted))" strokeWidth="8" fill="none" opacity="0.2" />
              <motion.circle
                cx="60"
                cy="60"
                r="54"
                className={progressColor}
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                initial={{ strokeDasharray: "0 339" }}
                animate={{ strokeDasharray: `${(percentage / 100) * 339} 339` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </svg>
            <div className="flex flex-col items-center justify-center text-center">
              <span className={`text-5xl font-black ${remaining <= 5 ? "text-orange-600" : "text-foreground"}`}>
                {remaining}
              </span>
              <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">minutes left</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <span>Used Today: {usedMinutes}m</span>
              <span>Daily Limit: {settings.dailyLimit}m</span>
            </div>
            <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
              <motion.div 
                className={`h-full ${remaining <= 5 ? "bg-orange-500" : "bg-primary"}`}
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 1 }}
              />
            </div>
          </div>
        </motion.div>

        <div className="space-y-8">
          {/* 3. Usage Mode Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-[40px] bg-white p-8 border border-white shadow-soft"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-black text-foreground tracking-tight">Usage Mode</h3>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {(["strict", "balanced", "learning"] as ScreenTimeMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => updateSettings({ mode })}
                  className={`flex items-start gap-4 p-5 rounded-3xl border transition-all text-left group ${
                    settings.mode === mode 
                      ? "bg-secondary/10 border-secondary/20 shadow-sm" 
                      : "bg-muted/5 border-transparent hover:border-muted-foreground/10"
                  }`}
                >
                  <div className={`mt-1 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    settings.mode === mode ? "border-secondary bg-secondary" : "border-muted-foreground/20"
                  }`}>
                    {settings.mode === mode && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  <div>
                    <h4 className={`text-sm font-black uppercase tracking-widest ${
                      settings.mode === mode ? "text-secondary" : "text-foreground/70"
                    }`}>
                      {mode} Mode
                    </h4>
                    <p className="text-xs font-bold text-muted-foreground/80 mt-1 leading-relaxed">
                      {mode === "strict" ? "Hard limit enforced. App locks immediately when time is up." :
                       mode === "balanced" ? "Grace period enabled (+5m). Warning alerts before locking." :
                       "Educational bonus (+15m). No hard lock during learning sessions."}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>

          {/* 4. Daily Limit & Toggle Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[40px] bg-white p-8 border border-white shadow-soft space-y-8"
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black text-foreground uppercase tracking-widest">Daily Interaction Limit</h3>
                <span className="text-lg font-black text-primary">{settings.dailyLimit}m</span>
              </div>
              <input
                type="range"
                min={15}
                max={180}
                step={15}
                value={settings.dailyLimit}
                onChange={(e) => updateSettings({ dailyLimit: Number(e.target.value) })}
                className="w-full h-2 bg-muted/30 rounded-full appearance-none cursor-pointer accent-primary"
              />
              <div className="mt-4 flex justify-between text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                <span>15m</span>
                <span>3h</span>
              </div>
            </div>

            <div className="pt-8 border-t border-muted/20 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-foreground uppercase tracking-widest">Enforce Restrictions</h3>
                <p className="text-xs font-bold text-muted-foreground italic">Automatically lock app when limit reached</p>
              </div>
              <button
                onClick={() => updateSettings({ restrictionEnabled: !settings.restrictionEnabled })}
                className={`relative h-8 w-14 rounded-full transition-all duration-300 ${
                  settings.restrictionEnabled ? "bg-primary shadow-soft" : "bg-muted"
                }`}
              >
                <div className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition-all duration-300 ${
                  settings.restrictionEnabled ? "left-[30px]" : "left-1"
                }`} />
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* 5. Usage Context Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[40px] bg-white p-8 border border-white shadow-soft"
      >
        <div className="flex items-center gap-3 mb-10">
          <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-mint/10 text-mint">
            <Activity className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-black text-foreground tracking-tight">Usage Context</h3>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Peak Time", value: analytics.peakTimeRange, icon: Clock, color: "text-primary bg-primary/5" },
            { label: "Active Days", value: `${analytics.activeDays} days`, icon: Calendar, color: "text-secondary bg-secondary/5" },
            { label: "Avg Session", value: `${analytics.avgSessionLength}m`, icon: History, color: "text-mint bg-mint/5" },
            { label: "Daily Sessions", value: analytics.sessionsToday.toString(), icon: Scale, color: "text-orange-500 bg-orange-50" }
          ].map((stat, i) => (
            <div key={i} className="rounded-3xl p-6 border border-muted/5 bg-muted/5 group hover:bg-white hover:shadow-soft transition-all">
              <div className={`mb-4 inline-flex rounded-xl p-2.5 ${stat.color} group-hover:scale-110 transition-transform`}>
                <stat.icon className="h-4 w-4" />
              </div>
              <p className="text-2xl font-black text-foreground mb-1">{stat.value}</p>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{stat.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Manual Override System */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-4"
      >
        <button
          onClick={() => updateSettings({ isLocked: !settings.isLocked })}
          className={`flex w-full items-center justify-center gap-3 rounded-[30px] p-6 text-sm font-black uppercase tracking-[0.2em] shadow-soft transition-all ${
            settings.isLocked
              ? "bg-destructive text-white hover:bg-destructive/90"
              : "bg-foreground text-background hover:scale-[1.01]"
          }`}
        >
          {settings.isLocked ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
          {settings.isLocked ? "App is Manually Locked — Tap to Unlock" : "Manual App Lock"}
        </button>
      </motion.div>
    </div>
  );
};

export default ScreenTimeControls;
