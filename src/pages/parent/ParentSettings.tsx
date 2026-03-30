import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, Trash2, ShieldCheck, Bell, FileDown, Loader2, Sparkles, CheckCircle } from "lucide-react";
import { isStrictModeEnabled, setStrictMode as saveStrictMode, updatePin } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { gatherAllAppData, generatePDFReport, ReportData } from "@/lib/reportService";
import { getConfig } from "@/lib/configStore";

const ParentSettings = () => {
  const config = getConfig();
  const [strictMode, setStrictMode] = useState(isStrictModeEnabled());
  const [notifications, setNotifications] = useState(true);
  const [showPinChange, setShowPinChange] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [pinSaved, setPinSaved] = useState(false);

  // Report states
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");

  const handleDownloadReport = async () => {
    const data = gatherAllAppData();
    
    // Check if there is enough data to generate a report
    const hasActivities = Array.isArray(data.activities) && data.activities.length > 0;
    const hasAlerts = Array.isArray(data.alerts) && data.alerts.length > 0;
    const hasIntelligence = data.intelligence && Object.keys(data.intelligence).length > 0;

    if (!hasActivities && !hasAlerts && !hasIntelligence) {
      alert("No data available to generate a report. Please interact with the AI assistant first!");
      return;
    }

    setIsGenerating(true);
    setProgress(5);
    setStatus("Gathering all conversation and safety data...");
    
    try {
      console.log("Sending data:", data);
      setProgress(15);
      
      setStatus("AI is analyzing 4 pages of developmental patterns...");
      const response = await fetch(`${config.api.baseUrl}${config.api.fullReport}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          allData: data 
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Report generation failed: ${errorText}`);
      }
      
      const reportData: ReportData = await response.json();
      
      // If we are in the "test success" phase, reportData might just be {success: true}
      // So we handle that gracefully
      if ((reportData as any).success && !(reportData as any).sections) {
        setStatus("Test route verified! Restoring AI logic...");
        setTimeout(() => {
          setIsGenerating(false);
          setProgress(0);
        }, 2000);
        return;
      }

      setProgress(40);
      setStatus("Generating high-resolution PDF structure...");

      await generatePDFReport(reportData, (p) => {
        setProgress(40 + (p * 0.6));
        if (p < 30) setStatus("Formatting Executive Summary...");
        else if (p < 60) setStatus("Analyzing Behavioral Trends...");
        else if (p < 90) setStatus("Structuring Strategic Recommendations...");
        else setStatus("Finalizing PDF export...");
      });

      setStatus("Report downloaded successfully!");
      setTimeout(() => {
        setIsGenerating(false);
        setProgress(0);
        setStatus("");
      }, 3000);

    } catch (error) {
      console.error("[Report] Generation error:", error);
      setStatus(`Error: ${error instanceof Error ? error.message : 'Could not generate report'}. Please try again.`);
      setTimeout(() => setIsGenerating(false), 5000);
    }
  };

  const handleToggleStrictMode = () => {
    const newState = !strictMode;
    setStrictMode(newState);
    saveStrictMode(newState);
  };

  const handleSavePin = async () => {
    if (newPin.length === 4) {
      updatePin(newPin);
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
      window.location.href = "/";
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

      {/* Full Report Download Section */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-[32px] bg-white p-8 shadow-card border border-primary/5 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Sparkles className="h-32 w-32 text-primary" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 flex items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileDown className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-black text-foreground tracking-tight uppercase tracking-widest text-xs">Deep Analytics</h3>
            </div>
            <h2 className="text-2xl font-black text-foreground">Download Full Development Report</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Generate a comprehensive 4-page PDF analysis of your child's behavior, 
              learning milestones, and safety trends powered by advanced AI.
            </p>
          </div>

          <div className="shrink-0">
            <Button 
              onClick={handleDownloadReport} 
              disabled={isGenerating}
              className="h-16 px-10 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-xs gap-3 shadow-soft group"
            >
              {isGenerating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <FileDown className="h-5 w-5 group-hover:translate-y-0.5 transition-transform" />
              )}
              {isGenerating ? "Generating Report..." : "Download Report"}
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-8 pt-6 border-t border-primary/5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                  {progress < 100 ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3 text-mint" />}
                  {status}
                </span>
                <span className="text-[10px] font-black text-primary">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 w-full bg-primary/5 rounded-full overflow-hidden p-0.5 border border-primary/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full rounded-full bg-primary"
                />
              </div>
              <p className="mt-4 text-[11px] text-muted-foreground italic text-center">
                This process involves analyzing interaction data. Please stay on this page.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

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
