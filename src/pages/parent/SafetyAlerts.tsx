import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Heart, Brain, Shield, CheckCircle, MessageCircle, X, Loader } from "lucide-react";
import { getAlerts, markAlertHandled } from "@/lib/alerts/alertService";
import { Alert } from "@/types";
import { useState, useEffect } from "react";
import { askParentAssistant } from "@/lib/groq";

const categoryStyles: Record<string, { label: string; color: string; icon: any }> = {
  violence: { label: "Harmful Content", color: "bg-destructive/10 text-destructive", icon: AlertTriangle },
  "self-harm": { label: "Self-Harm Risk", color: "bg-destructive/10 text-destructive", icon: AlertTriangle },
  emotional: { label: "Emotional Distress", color: "bg-orange-100 text-orange-600", icon: Heart },
  emotional_build_up: { label: "Emotional Buildup", color: "bg-orange-100 text-orange-600", icon: Heart },
  frustration: { label: "High Frustration", color: "bg-orange-100 text-orange-600", icon: AlertTriangle },
  confusion: { label: "Deep Confusion", color: "bg-lavender/15 text-foreground", icon: Brain },
  suspicious: { label: "Suspicious Intent", color: "bg-lavender/15 text-foreground", icon: Brain },
  safe: { label: "Safe Interaction", color: "bg-mint/10 text-mint", icon: Shield },
};

const SafetyAlerts = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [coachingAlert, setCoachingAlert] = useState<Alert | null>(null);
  const [coachingAdvice, setCoachingAdvice] = useState<string | null>(null);
  const [isCoaching, setIsCoaching] = useState(false);

  useEffect(() => {
    const loadAlerts = () => {
      setAlerts(getAlerts());
    };
    
    loadAlerts();
    
    // Refresh every 5 seconds to match dashboard behavior
    const interval = setInterval(loadAlerts, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkHandled = (id: string) => {
    markAlertHandled(id);
    setAlerts(getAlerts());
  };

  const handleCoachMe = async (alert: Alert) => {
    setCoachingAlert(alert);
    setIsCoaching(true);
    setCoachingAdvice(null);
    
    try {
      const prompt = `My child said: "${alert.message}". The AI flagged this as "${alert.category}" because "${alert.reason}". How should I talk to my child about this? Provide a script or specific advice to help me handle this situation with empathy and safety in mind. Keep it under 100 words.`;
      const advice = await askParentAssistant(prompt);
      setCoachingAdvice(advice);
    } catch (error) {
      console.error("[SafetyAlerts] Coaching failed:", error);
      setCoachingAdvice("Sorry, I couldn't generate advice right now. Please try again.");
    } finally {
      setIsCoaching(false);
    }
  };

  // Stats calculation
  const highRiskCount = alerts.filter(a => a.severity === "high").length;
  const unhandledCount = alerts.filter(a => !a.handled).length;
  const totalAlerts = alerts.length;

  // Helper to format time
  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hours ago`;
    return new Date(ts).toLocaleDateString();
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-foreground">Safety & Alerts</h2>
          <p className="text-sm text-muted-foreground">Real-time LLM-based risk detection and behavioral monitoring.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-2xl border border-primary/10">
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-xs font-black uppercase tracking-widest text-primary">Live Protection Active</span>
        </div>
      </div>

      {/* Alert Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "High Risk detected", count: highRiskCount, color: "bg-destructive/10 text-destructive", icon: AlertTriangle },
          { label: "Awaiting Review", count: unhandledCount, color: "bg-orange-100 text-orange-600", icon: Brain },
          { label: "Total Alerts", count: totalAlerts, color: "bg-primary/10 text-primary", icon: Shield },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-3xl bg-card p-6 shadow-soft border border-border/50"
          >
            <div className={`mb-4 inline-flex rounded-2xl p-3 ${stat.color}`}>
              <stat.icon className="h-6 w-6" />
            </div>
            <p className="text-3xl font-black text-foreground">{stat.count}</p>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground/70 flex items-center gap-2">
          Recent Activity Logs
          <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
          {alerts.length} Total
        </h3>

        {alerts.length === 0 ? (
          <div className="rounded-[32px] bg-card border-2 border-dashed border-muted p-12 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-mint/10">
              <CheckCircle className="h-10 w-10 text-mint" />
            </div>
            <h4 className="text-xl font-bold text-foreground">Alex is safe and curious!</h4>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
              The AI safety layer hasn't detected any high-risk messages or emotional distress signals.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert, i) => {
              const style = categoryStyles[alert.category] || categoryStyles.safe;
              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`rounded-[24px] bg-card p-6 shadow-soft border transition-all ${
                    alert.handled ? 'opacity-60 grayscale-[0.5]' : 'border-primary/10'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${style.color}`}>
                        <style.icon className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${style.color}`}>
                            {style.label}
                          </span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            {formatTime(alert.timestamp)}
                          </span>
                        </div>
                        <p className="text-lg font-bold text-foreground leading-tight">
                          "{alert.message}"
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">AI Analysis:</span>
                          <p className="text-[11px] font-medium text-muted-foreground italic line-clamp-1">
                            {alert.reason}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-center">
                      {!alert.handled ? (
                        <>
                          <button
                            onClick={() => handleCoachMe(alert)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent/10 text-accent text-xs font-black uppercase tracking-widest hover:bg-accent/20 transition-all border border-accent/10 shadow-sm"
                          >
                            <MessageCircle className="h-4 w-4" />
                            Coach Me
                          </button>
                          <button
                            onClick={() => handleMarkHandled(alert.id)}
                            className="px-6 py-2.5 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-soft"
                          >
                            Mark as Reviewed
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 px-4 py-2 bg-mint/10 rounded-xl text-mint">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Reviewed</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Coaching Modal */}
      <AnimatePresence>
        {coachingAlert && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-card rounded-[32px] p-8 shadow-2xl border border-border overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4">
                <button 
                  onClick={() => {
                    setCoachingAlert(null);
                    setCoachingAdvice(null);
                  }}
                  className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-accent/10 text-accent">
                  <Brain className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-foreground tracking-tight">Parent AI Coaching</h3>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Strategic Guidance System</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl bg-muted/30 p-4 border border-border/50">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Child's Message</p>
                  <p className="text-sm font-bold text-foreground italic leading-relaxed">"{coachingAlert.message}"</p>
                </div>

                <div className="relative min-h-[120px]">
                  {isCoaching ? (
                    <div className="flex flex-col items-center justify-center gap-4 py-8">
                      <Loader className="h-8 w-8 animate-spin text-accent" />
                      <p className="text-xs font-black text-muted-foreground uppercase tracking-widest animate-pulse">Consulting safety experts...</p>
                    </div>
                  ) : (
                    coachingAdvice && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-1 w-1 rounded-full bg-accent" />
                          <h4 className="text-[11px] font-black text-accent uppercase tracking-widest">Recommended Approach</h4>
                        </div>
                        <p className="text-[15px] font-medium text-foreground/80 leading-relaxed bg-accent/5 p-5 rounded-2xl border border-accent/10 italic">
                          {coachingAdvice}
                        </p>
                        <button
                          onClick={() => {
                            setCoachingAlert(null);
                            setCoachingAdvice(null);
                          }}
                          className="w-full py-3.5 rounded-2xl bg-foreground text-background text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-soft mt-4"
                        >
                          Got it, Thanks!
                        </button>
                      </motion.div>
                    )
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SafetyAlerts;
