import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { KeyRound, Trash2, ShieldCheck, Bell } from "lucide-react";
import { isStrictModeEnabled, setStrictMode as saveStrictMode, updatePin } from "@/lib/auth";

const ParentSettings = () => {
  const [strictMode, setStrictMode] = useState(isStrictModeEnabled());
  const [notifications, setNotifications] = useState(true);
  const [showPinChange, setShowPinChange] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [pinSaved, setPinSaved] = useState(false);

  const handleToggleStrictMode = () => {
    const newState = !strictMode;
    setStrictMode(newState);
    saveStrictMode(newState);
  };

  const handleSavePin = async () => {
    if (newPin.length === 4) {
      await updatePin(newPin);
      setPinSaved(true);
      setTimeout(() => {
        setShowPinChange(false);
        setNewPin("");
        setPinSaved(false);
      }, 1500);
    }
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset all data? This cannot be undone.")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const ToggleSwitch = ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
    <button
      onClick={onToggle}
      className={`relative h-7 w-12 rounded-full transition-colors ${enabled ? "bg-primary" : "bg-muted"}`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-card shadow-sm transition-transform ${
          enabled ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );

  const settingsItems = [
    {
      icon: KeyRound,
      title: "Change PIN",
      description: "Update your dashboard access PIN",
      action: () => setShowPinChange(!showPinChange),
      color: "bg-primary/10 text-primary",
    },
    {
      icon: Trash2,
      title: "Reset Data",
      description: "Clear all local storage data",
      action: handleReset,
      color: "bg-destructive/10 text-destructive",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-black text-foreground tracking-tight">Settings</h2>
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-1">Configure dashboard preferences</p>
      </div>

      {/* Toggles */}
      <div className="grid gap-4 sm:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-3xl bg-white p-6 shadow-card border border-primary/5 hover:shadow-soft transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="inline-flex rounded-2xl bg-primary/10 p-3">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground uppercase tracking-tight">Strict Mode</h3>
              <p className="text-xs font-medium text-muted-foreground">Block sensitive topics</p>
            </div>
          </div>
          <ToggleSwitch enabled={strictMode} onToggle={handleToggleStrictMode} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="flex items-center justify-between rounded-3xl bg-white p-6 shadow-card border border-primary/5 hover:shadow-soft transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="inline-flex rounded-2xl bg-accent/10 p-3">
              <Bell className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground uppercase tracking-tight">Notifications</h3>
              <p className="text-xs font-medium text-muted-foreground">Get safety alerts</p>
            </div>
          </div>
          <ToggleSwitch enabled={notifications} onToggle={() => setNotifications(!notifications)} />
        </motion.div>
      </div>

      {/* Action Items */}
      <div className="grid gap-4">
        {settingsItems.map((item, i) => (
          <motion.button
            key={item.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.08 }}
            whileHover={{ scale: 1.01, x: 4 }}
            whileTap={{ scale: 0.99 }}
            onClick={item.action}
            className="flex w-full items-center gap-4 rounded-3xl bg-white p-6 text-left shadow-card border border-primary/5 transition-all hover:shadow-soft hover:border-primary/10"
          >
            <div className={`inline-flex rounded-2xl p-3 ${item.color}`}>
              <item.icon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-black text-foreground uppercase tracking-tight">{item.title}</h3>
              <p className="text-xs font-medium text-muted-foreground">{item.description}</p>
            </div>
          </motion.button>
        ))}
      </div>

      {/* PIN Change Modal */}
      {showPinChange && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl bg-gradient-to-br from-primary/10 to-accent/5 p-8 shadow-soft border border-primary/10"
        >
          <h3 className="mb-4 text-sm font-black text-foreground uppercase tracking-widest text-center">Enter New 4-Digit PIN</h3>
          <div className="flex flex-col sm:flex-row gap-4 max-w-sm mx-auto">
            <input
              type="password"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="flex-1 rounded-2xl border border-primary/20 bg-white px-6 py-4 text-center text-2xl font-black tracking-[1em] outline-none ring-primary/20 focus:ring-4 transition-all"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSavePin}
              disabled={newPin.length !== 4}
              className="rounded-2xl gradient-hero px-8 py-4 text-xs font-black uppercase tracking-widest text-white shadow-soft disabled:opacity-40 transition-all hover:shadow-glow"
            >
              {pinSaved ? "✓ Saved" : "Update"}
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ParentSettings;
