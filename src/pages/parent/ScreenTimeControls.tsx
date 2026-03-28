import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Lock, Unlock, Clock } from "lucide-react";
import { getScreenTimeSettings, setScreenTimeSettings, getUsedMinutesToday } from "@/lib/screen-time";

const ScreenTimeControls = () => {
  const [settings, setLocalSettings] = useState(getScreenTimeSettings());
  const [usedMinutes, setUsedMinutes] = useState(getUsedMinutesToday());

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

  const remaining = Math.max(0, settings.dailyLimit - usedMinutes);
  const percentage = Math.min(100, Math.round((usedMinutes / settings.dailyLimit) * 100));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-foreground">Screen Time Controls</h2>
        <p className="text-sm text-muted-foreground">Manage Alex's daily usage limits.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Time Remaining */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-card p-6 shadow-card"
        >
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold text-foreground">Time Remaining</h3>
          </div>
          <div className="relative mx-auto h-40 w-40">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" stroke="hsl(var(--muted))" strokeWidth="10" fill="none" />
              <circle
                cx="60"
                cy="60"
                r="50"
                stroke="hsl(var(--primary))"
                strokeWidth="10"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${(percentage / 100) * 314} 314`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold text-foreground">{remaining}m</span>
              <span className="text-xs text-muted-foreground">left today</span>
            </div>
          </div>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {usedMinutes}m used of {settings.dailyLimit}m
          </p>
        </motion.div>

        {/* Controls */}
        <div className="space-y-4">
          {/* Daily Limit */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl bg-card p-5 shadow-card"
          >
            <h3 className="mb-3 text-sm font-bold text-foreground">Daily Limit (minutes)</h3>
            <input
              type="range"
              min={15}
              max={180}
              step={15}
              value={settings.dailyLimit}
              onChange={(e) => updateSettings({ dailyLimit: Number(e.target.value) })}
              className="w-full accent-primary"
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>15m</span>
              <span className="font-bold text-primary">{settings.dailyLimit}m</span>
              <span>3h</span>
            </div>
          </motion.div>

          {/* Usage Restriction Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-between rounded-2xl bg-card p-5 shadow-card"
          >
            <div>
              <h3 className="text-sm font-bold text-foreground">Usage Restrictions</h3>
              <p className="text-xs text-muted-foreground">Enforce daily time limits</p>
            </div>
            <button
              onClick={() => updateSettings({ restrictionEnabled: !settings.restrictionEnabled })}
              className={`relative h-7 w-12 rounded-full transition-colors ${
                settings.restrictionEnabled ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-card shadow-sm transition-transform ${
                  settings.restrictionEnabled ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </motion.div>

          {/* Instant Lock */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => updateSettings({ isLocked: !settings.isLocked })}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl p-4 text-sm font-bold shadow-card transition-colors ${
                settings.isLocked
                  ? "bg-destructive text-destructive-foreground"
                  : "gradient-hero text-primary-foreground"
              }`}
            >
              {settings.isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
              {settings.isLocked ? "App is Locked — Tap to Unlock" : "Lock App Now"}
            </motion.button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ScreenTimeControls;
