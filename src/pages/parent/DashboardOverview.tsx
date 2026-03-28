import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  MessageSquare,
  AlertTriangle,
  Smile,
  BookOpen,
  Timer,
  Lightbulb,
  Brain,
  Target,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Loader,
  Sparkle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { getLatestIntelligence, IntelligenceMetrics as NewIntelligenceMetrics } from "@/lib/intelligence";
import { Alert, Intervention } from "@/types";
import { 
  getActivity, 
  formatTime, 
  getTotalQuestions, 
  getFlaggedCount, 
  getTopInterest, 
  getWeeklyChange,
  getActivitySummary,
  getSentimentTrend
} from "@/lib/activity";
import { getUsedMinutesToday } from "@/lib/screen-time";
import { 
  detectRiskyMessage, 
  rewriteUnsafe, 
  analyzeBehaviorPattern, 
  PatternRisk 
} from "@/lib/safety";
import { getAlerts, getLatestUnhandledAlert, markAlertHandled } from "@/lib/alerts/alertService";
import { setMode, getMode } from "@/lib/intervention/modeService";
import { injectSystemMessage } from "@/lib/intervention/injectionService";
import { saveIntervention, getInterventions } from "@/lib/intervention/interventionService";
import { askParentAssistant } from "@/lib/groq";

interface AIInsights {
  keyInsight: string;
  smartInsights: string[];
}

const DashboardOverview = () => {
  const navigate = useNavigate();
  
  // State for production-grade intelligence metrics
  const [intelligence, setIntelligence] = useState<NewIntelligenceMetrics | null>(null);
  
  // Get real activity from localStorage
  const activities = getActivity();

  // Check if we have data
  const hasData = activities.length > 0;

  // Real statistics from centralized utility
  const totalQuestions = getTotalQuestions();
  const flagged = getFlaggedCount();
  const topInterest = getTopInterest();
  const weeklyChangeText = getWeeklyChange();

  // Real usage from screen-time utility
  const totalUsageMinutes = getUsedMinutesToday();
  const usageHours = Math.floor(totalUsageMinutes / 60);
  const usageMins = totalUsageMinutes % 60;
  const usageText = hasData ? (usageHours > 0 ? `${usageHours}h ${usageMins}m` : `${usageMins}m`) : "0m";

  // State for AI Insights
  const [aiInsights, setAiInsights] = useState<AIInsights | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch Intelligence Metrics
  useEffect(() => {
    const fetchIntelligence = async () => {
      try {
        const metrics = await getLatestIntelligence();
        setIntelligence(metrics);
      } catch (error) {
        console.error("[Dashboard] Error fetching intelligence:", error);
      }
    };
    fetchIntelligence();
  }, [totalQuestions]);

  // Fetch AI Insights with caching
  useEffect(() => {
    if (!hasData) return;

    const fetchInsights = async () => {
      const summary = getActivitySummary();
      const cached = localStorage.getItem("ai_insights_cache");
      const lastActivityCount = localStorage.getItem("ai_insights_activity_count");
      
      if (cached && lastActivityCount === totalQuestions.toString()) {
        const { data, timestamp } = JSON.parse(cached);
        const tenMinutes = 10 * 60 * 1000;
        if (Date.now() - timestamp < tenMinutes) {
          setAiInsights(data);
          return;
        }
      }

      setIsGenerating(true);
      try {
        const response = await fetch("http://localhost:3001/api/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ summary }),
        });

        if (response.ok) {
          const data = await response.json();
          // Validate data schema before setting
          if (data && typeof data.keyInsight === 'string' && Array.isArray(data.smartInsights)) {
            setAiInsights(data);
            localStorage.setItem("ai_insights_cache", JSON.stringify({ data, timestamp: Date.now() }));
            localStorage.setItem("ai_insights_activity_count", totalQuestions.toString());
          } else {
            console.error("[Dashboard] Invalid insights schema received:", data);
          }
        }
      } catch (error) {
        console.error("[Dashboard] Error fetching AI insights:", error);
      } finally {
        setIsGenerating(false);
      }
    };

    fetchInsights();
  }, [hasData, totalQuestions]);

  // Detect mood from real recent messages
  let mood = "No data yet";
  
  if (hasData) {
    mood = "Curious 🤔";
    const recentMessages = activities.slice(0, 10);
    let lowEngagement = 0;
    let emotional = 0;
    
    for (let i = 0; i < recentMessages.length; i++) {
      const text = recentMessages[i].userText.toLowerCase();
      if (text.includes("ok") || text.includes("yes") || text.includes("k")) {
        lowEngagement++;
      }
      if (text.includes("sad") || text.includes("angry") || text.includes("bored")) {
        emotional++;
      }
    }
    
    if (lowEngagement > 3) mood = "Low Engagement 😐";
    else if (emotional > 2) mood = "Emotional 😟";
  }

  // State for AI explanation
  const [deepAnalysis, setDeepAnalysis] = useState<{
    analysis: string;
    severity: "low" | "medium" | "high";
    signals: string[];
    recommended_actions: string[];
    pattern?: {
      exists: boolean;
      type: string;
      confidence: number;
      explanation: string;
    };
  } | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [insightType, setInsightType] = useState<"safety" | "learning" | "engagement">("learning");

  // State for Instant Alert Banner
  const [activeAlert, setActiveAlert] = useState<Alert | null>(null);

  const [interventions, setInterventions] = useState<Intervention[]>([]);

  // Fetch Latest Unhandled Alert
  useEffect(() => {
    const checkAlerts = () => {
      const alerts = getAlerts().filter(a => !a.handled);
      if (alerts.length === 0) {
        setActiveAlert(null);
        return;
      }

      // Priority logic: High alert (risk) first, then Early Warning
      const highPriority = alerts.find(a => a.severity === 'high' && a.type !== 'early_warning');
      const earlyWarning = alerts.find(a => a.type === 'early_warning');
      
      setActiveAlert(highPriority || earlyWarning || alerts[0]);
    };

    const fetchInterventions = () => {
      setInterventions(getInterventions().slice(0, 3));
    };
    
    checkAlerts();
    fetchInterventions();
    // Check for alerts every 5 seconds to feel "instant"
    const interval = setInterval(() => {
      checkAlerts();
      fetchInterventions();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleReviewAlert = (id: string) => {
    markAlertHandled(id);
    setActiveAlert(null);
  };

  const handleCalmChild = (id: string) => {
    setMode("support");
    injectSystemMessage("Parent activated support mode. Respond with empathy and help child process emotions.");
    
    // Track intervention
    saveIntervention({
      id: `int-${Date.now()}`,
      type: "calm",
      timestamp: Date.now(),
      related_alert_id: id,
      messages_before: activities.slice(0, 5).map(a => ({ text: a.userText, timestamp: a.timestamp })),
      messages_after: []
    });

    markAlertHandled(id);
    setActiveAlert(null);
    alert("🧠 Support Mode Activated. The AI will now focus on emotional support.");
  };

  const handleStrictMode = (id: string) => {
    setMode("strict");
    
    // Track intervention
    saveIntervention({
      id: `int-${Date.now()}`,
      type: "strict",
      timestamp: Date.now(),
      related_alert_id: id,
      messages_before: activities.slice(0, 5).map(a => ({ text: a.userText, timestamp: a.timestamp })),
      messages_after: []
    });

    markAlertHandled(id);
    setActiveAlert(null);
    alert("🛡️ Strict Mode Activated. The AI will now be more protective.");
  };

  const handleGuideConversation = async (alertData: Alert) => {
    try {
      const prompt = `You are a parent assistant. Given a risky child message: "${alertData.message}", suggest a safe and engaging topic to redirect the conversation. Keep it very short, like one sentence.`;
      const suggestion = await askParentAssistant(prompt);
      
      if (suggestion) {
        injectSystemMessage(`Parent suggested redirecting the conversation. Use this idea: ${suggestion}`);
        
        // Track intervention
        saveIntervention({
          id: `int-${Date.now()}`,
          type: "guide",
          timestamp: Date.now(),
          related_alert_id: alertData.id,
          messages_before: activities.slice(0, 5).map(a => ({ text: a.userText, timestamp: a.timestamp })),
          messages_after: []
        });

        markAlertHandled(alertData.id);
        setActiveAlert(null);
        alert(`✨ Conversation Guided. The AI was instructed to redirect using: "${suggestion}"`);
      }
    } catch (error) {
      console.error("[Dashboard] Error guiding conversation:", error);
    }
  };

  // Relative time formatter
  const getRelativeTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  // Get parent summary from AI insights or fallback
  const parentSummary = aiInsights?.keyInsight || (hasData ? "Analyzing Alex's learning patterns..." : "Your child is developing consistent learning patterns");
  const insights = aiInsights?.smartInsights || [];

  // Get action type from insight
  function getActionType(insight: string): string {
    const lower = insight.toLowerCase();
    if (lower.includes("attention")) return "attention_support";
    if (lower.includes("math")) return "math_support";
    if (lower.includes("curiosity")) return "curiosity_boost";
    if (lower.includes("creative") || lower.includes("story")) return "creativity_encouragement";
    return "general_support";
  }

  // Handle applying suggestion
  function handleApplySuggestion(insight: string) {
    // 1. Save to policies for display
    const existingPolicies = JSON.parse(localStorage.getItem("parent_policies") || "[]");
    if (!existingPolicies.includes(insight)) {
      const updatedPolicies = [insight, ...existingPolicies].slice(0, 10);
      localStorage.setItem("parent_policies", JSON.stringify(updatedPolicies));
    }
    
    // 2. Save to actions for AI system prompt injection
    const actionType = getActionType(insight);
    const existingActions = JSON.parse(localStorage.getItem("parent_actions") || "[]");
    
    // Check if action type already exists
    const actionExists = existingActions.some((a: any) => a.type === actionType);
    
    if (!actionExists) {
      const newAction = {
        id: Date.now().toString(),
        type: actionType,
        title: insight.split('.')[0], // Use first sentence as title
        description: insight,
        status: "active",
        timestamp: Date.now()
      };
      const updatedActions = [newAction, ...existingActions];
      localStorage.setItem("parent_actions", JSON.stringify(updatedActions));
    }
    
    // Visual feedback
    alert("✅ Added to AI Policy. The AI will now adjust its behavior based on this insight.");
  }

  // Get type from insight content
  function getInsightType(insight: string): "safety" | "learning" | "engagement" {
    const lower = insight.toLowerCase();
    if (lower.includes("risk") || lower.includes("safety") || lower.includes("emotional") || lower.includes("behavior")) return "safety";
    if (lower.includes("math") || lower.includes("science") || lower.includes("skill") || lower.includes("learning")) return "learning";
    return "engagement";
  }

  // Handle insight click
  async function handleExplainInsight(insight: string) {
    const type = getInsightType(insight);
    setIsExplaining(true);
    setDeepAnalysis(null);
    setInsightType(type);
    
    try {
      const summary = getActivitySummary();
      const allActivities = getActivity();
      
      // Domain-Scoped Context Selection
      let filteredContext = [];
      let flaggedMsg = null;

      if (type === "safety") {
        // Flagged + nearby messages
        const flaggedIdx = allActivities.findIndex(a => a.risk?.is_flagged);
        if (flaggedIdx !== -1) {
          flaggedMsg = allActivities[flaggedIdx].userText;
          filteredContext = allActivities.slice(Math.max(0, flaggedIdx - 2), flaggedIdx + 3).map(a => a.userText);
        } else {
          filteredContext = allActivities.slice(0, 5).map(a => a.userText);
        }
      } else if (type === "learning") {
        // Only learning-related messages, filter out high-risk
        filteredContext = allActivities
          .filter(a => a.category === "Math" || a.category === "Science")
          .filter(a => !a.risk?.is_flagged || a.risk.severity !== "high")
          .slice(0, 8)
          .map(a => a.userText);
      } else {
        // Engagement: recent window, filter high-risk
        filteredContext = allActivities
          .filter(a => !a.risk?.is_flagged || a.risk.severity !== "high")
          .slice(0, 10)
          .map(a => a.userText);
      }

      const response = await fetch("http://localhost:3001/api/deep-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          insight, 
          summary,
          flaggedMessage: flaggedMsg,
          recentContext: filteredContext,
          insightType: type
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Signal Filtering: Limit to max 3 relevant signals
        if (data.signals) {
          data.signals = Array.from(new Set(data.signals)).slice(0, 3);
        }

        setDeepAnalysis(data);
      } else {
        throw new Error("Deep analysis failed");
      }
    } catch (error) {
      console.error("[Dashboard] Error explaining insight:", error);
    }
  }

  // Sentiment trend data
  const sentimentTrend = getSentimentTrend();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-foreground">Welcome back, Parent 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's how Alex is doing this week.
        </p>
      </div>

      <AnimatePresence>
        {activeAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            className="overflow-hidden"
          >
            <div className={`mb-6 rounded-[24px] border p-6 shadow-soft relative ${
              activeAlert.type === 'early_warning' 
                ? 'bg-orange-50/50 border-orange-200/50' 
                : 'bg-destructive/5 border-destructive/20'
            }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className={`mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                    activeAlert.type === 'early_warning' ? 'bg-orange-100 text-orange-600' : 'bg-destructive/10 text-destructive'
                  }`}>
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className={`text-sm font-black uppercase tracking-widest ${
                        activeAlert.type === 'early_warning' ? 'text-orange-700' : 'text-destructive'
                      }`}>
                        {activeAlert.type === 'early_warning' ? '⚠️ Early Warning Detected' : '⚠️ High Priority Alert'}
                      </h3>
                      <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                        {getRelativeTime(activeAlert.timestamp)}
                      </span>
                    </div>
                    <p className="text-base font-bold text-foreground leading-tight line-clamp-1">
                      "{activeAlert.message}"
                    </p>
                    <p className="text-xs font-medium text-muted-foreground">
                      Category: <span className="font-bold uppercase tracking-wider">{activeAlert.category}</span>
                    </p>
                    
                    {/* One-Tap Intervention Buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <button 
                        onClick={() => handleCalmChild(activeAlert.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors border ${
                          activeAlert.type === 'early_warning' 
                            ? 'bg-white text-orange-700 hover:bg-orange-50 border-orange-200' 
                            : 'bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200'
                        }`}
                      >
                        <Smile className="h-3 w-3" />
                        Calm Child
                      </button>
                      <button 
                        onClick={() => handleStrictMode(activeAlert.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors border ${
                          activeAlert.type === 'early_warning'
                            ? 'bg-white text-destructive hover:bg-destructive/5 border-destructive/10'
                            : 'bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20'
                        }`}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        Strict Mode
                      </button>
                      <button 
                        onClick={() => handleGuideConversation(activeAlert)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors border ${
                          activeAlert.type === 'early_warning'
                            ? 'bg-white text-primary hover:bg-primary/5 border-primary/10'
                            : 'bg-primary/10 text-primary hover:bg-primary/20 border-primary/20'
                        }`}
                      >
                        <Brain className="h-3 w-3" />
                        Guide Conversation
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => navigate("/parent-dashboard/safety")}
                    className="px-5 py-2.5 rounded-xl bg-white border border-muted-foreground/10 text-xs font-black uppercase tracking-widest hover:bg-muted/10 transition-colors shadow-sm"
                  >
                    View Details
                  </button>
                  <button 
                    onClick={() => handleReviewAlert(activeAlert.id)}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-soft ${
                      activeAlert.type === 'early_warning' ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-destructive text-white hover:bg-destructive/90'
                    }`}
                  >
                    Mark as Reviewed
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Parent Summary Insight */}
      {hasData ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.01 }}
          className="rounded-3xl bg-gradient-to-br from-primary/20 via-primary/5 to-accent/5 p-8 shadow-soft border border-primary/20 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Sparkles className="h-24 w-24 text-primary" />
          </div>
          <div className="flex items-start gap-4 relative z-10">
            <div className="mt-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-sm font-black uppercase tracking-widest text-primary/80">Key AI Insight</h2>
                <span className="h-1 w-1 rounded-full bg-primary/30" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Just Generated</span>
              </div>
              <p className="text-xl font-extrabold text-foreground leading-snug max-w-2xl">
                {parentSummary || "Your child is developing consistent learning patterns"}
              </p>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-card/50 border-2 border-dashed border-muted p-10 text-center"
        >
          <div className="mx-auto h-16 w-16 items-center justify-center rounded-3xl bg-muted flex mb-4">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Unlock AI Insights</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">Start chatting with Alex to help the AI understand learning patterns and generate personalized observations.</p>
        </motion.div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: "Usage This Week",
            value: usageText,
            icon: Clock,
            subtitle: `${weeklyChangeText} from last week`,
            color: "bg-primary/10 text-primary",
            gradient: "from-primary/5 to-transparent",
          },
          {
            title: "Questions Asked",
            value: totalQuestions.toString(),
            icon: MessageSquare,
            subtitle: `Top interest: ${topInterest}`,
            color: "bg-secondary/20 text-secondary",
            gradient: "from-secondary/5 to-transparent",
          },
          {
            title: "Flagged Queries",
            value: flagged.toString(),
            icon: AlertTriangle,
            subtitle: "All reviewed",
            color: "bg-destructive/10 text-destructive",
            gradient: "from-destructive/5 to-transparent",
          },
          {
            title: "Overall Mood",
            value: mood,
            icon: Smile,
            subtitle: "Based on recent queries",
            color: "bg-accent/20 text-accent-foreground",
            gradient: "from-accent/5 to-transparent",
          },
        ].map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4, scale: 1.02 }}
            transition={{ delay: index * 0.08 }}
          >
            <Card className={`p-6 shadow-card border-none bg-gradient-to-br ${stat.gradient} relative overflow-hidden group`}>
              <div className="relative z-10">
                <div className={`mb-4 inline-flex rounded-2xl p-3 ${stat.color} group-hover:scale-110 transition-transform`}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <p className="text-3xl font-black text-foreground mb-1">{stat.value}</p>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{stat.title}</p>
                <div className="mt-4 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                  <p className="text-[11px] font-semibold text-muted-foreground">{stat.subtitle}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Intervention Outcomes Section */}
      {interventions.length > 0 && interventions.some(i => i.outcome) && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground/70">Recent Intervention Results</h2>
            <div className="h-px flex-1 bg-border/50" />
          </div>
          
          <div className="grid gap-4 md:grid-cols-3">
            {interventions.filter(i => i.outcome).map((int) => (
              <Card key={int.id} className="p-5 shadow-soft border-none bg-white relative overflow-hidden group">
                <div className={`absolute top-0 left-0 w-1 h-full ${
                  int.outcome?.outcome === 'improved' ? 'bg-mint' :
                  int.outcome?.outcome === 'worsened' ? 'bg-destructive' :
                  'bg-orange-400'
                }`} />
                
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {int.type === 'calm' ? '🧠 Support' : int.type === 'strict' ? '🛡️ Strict' : '✨ Guide'} Mode Impact
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">
                      {getRelativeTime(int.timestamp)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`h-2 w-2 rounded-full ${
                      int.outcome?.outcome === 'improved' ? 'bg-mint animate-pulse' :
                      int.outcome?.outcome === 'worsened' ? 'bg-destructive' :
                      'bg-orange-400'
                    }`} />
                    <p className={`text-xs font-black uppercase tracking-widest ${
                      int.outcome?.outcome === 'improved' ? 'text-mint' :
                      int.outcome?.outcome === 'worsened' ? 'text-destructive' :
                      'text-orange-600'
                    }`}>
                      {int.outcome?.outcome === 'improved' ? 'Improved' :
                       int.outcome?.outcome === 'worsened' ? 'Worsened' : 'Unchanged'}
                    </p>
                  </div>
                  
                  <p className="text-sm font-bold text-foreground leading-snug mb-2">
                    {int.outcome?.explanation}
                  </p>
                  
                  <div className="mt-auto pt-3 flex items-center gap-1.5 border-t border-border/50">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Confidence:</span>
                    <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          int.outcome?.outcome === 'improved' ? 'bg-mint' : 'bg-primary/40'
                        }`}
                        style={{ width: `${int.outcome?.confidence}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-black text-foreground">{int.outcome?.confidence}%</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {/* Smart Insights */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="p-8 shadow-card border-none bg-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary/40" />
          {!hasData ? (
            <div className="rounded-2xl bg-muted/30 p-10 text-center border border-dashed border-muted">
              <Sparkles className="mx-auto mb-4 h-10 w-10 text-muted-foreground opacity-50" />
              <h2 className="text-xl font-bold text-foreground">Discover Smart Insights</h2>
              <p className="mt-2 text-sm text-muted-foreground">Detailed learning patterns will appear here as Alex explores new topics.</p>
            </div>
          ) : isGenerating ? (
            <div className="rounded-2xl bg-muted/30 p-12 text-center">
              <Loader className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
              <h2 className="text-xl font-bold text-foreground">Analyzing Activity...</h2>
              <p className="mt-2 text-sm text-muted-foreground italic">Our AI is looking for patterns in Alex's conversations</p>
            </div>
          ) : (
            <>
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-foreground flex items-center gap-2">
                    <Lightbulb className="h-6 w-6 text-accent" />
                    Smart Insights
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1 font-medium">Personalized observations and suggestions for Alex</p>
                </div>
                <div className="hidden sm:flex items-center gap-2 rounded-2xl bg-primary/10 px-4 py-2 text-[11px] font-black text-primary uppercase tracking-widest border border-primary/10">
                  <Sparkle className="h-3.5 w-3.5" />
                  AI Intelligence
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {insights.length > 0 ? (
                  insights.map((insight, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + index * 0.08 }}
                      className="group flex items-start gap-4 rounded-3xl bg-background p-5 hover:bg-white hover:shadow-soft border border-transparent hover:border-primary/10 transition-all cursor-default"
                    >
                      <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 group-hover:bg-primary text-primary group-hover:text-white transition-all">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div className="flex flex-1 flex-col gap-3">
                        <p className="text-[15px] font-bold leading-relaxed text-foreground/90">{insight}</p>
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => handleExplainInsight(insight)}
                            className="flex items-center gap-1.5 text-[11px] font-black text-primary/70 hover:text-primary uppercase tracking-wider transition-colors"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            Deep Analysis
                          </button>
                          <button
                            onClick={() => handleApplySuggestion(insight)}
                            className="flex items-center gap-1.5 text-[11px] font-black text-secondary/70 hover:text-secondary uppercase tracking-wider transition-colors"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Add to Policy
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-full py-8 text-center border-2 border-dashed border-muted rounded-3xl">
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">More activity needed for deep analysis</p>
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      </motion.div>

      {/* AI Explanation Modal/Section */}
      {isExplaining && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`mt-6 rounded-2xl bg-white p-8 border shadow-soft relative overflow-hidden ${
            insightType === 'safety' ? 'border-destructive/20' :
            insightType === 'learning' ? 'border-primary/20' :
            'border-secondary/20'
          }`}
        >
          <div className="absolute top-0 right-0 p-4">
            <button 
              onClick={() => setIsExplaining(false)}
              className="text-muted-foreground hover:text-foreground transition-colors p-2"
            >
              <CheckCircle className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center gap-3 mb-8">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
              insightType === 'safety' ? 'bg-destructive/10 text-destructive' :
              insightType === 'learning' ? 'bg-primary/10 text-primary' :
              'bg-secondary/10 text-secondary'
            }`}>
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-foreground tracking-tight">
                {insightType.charAt(0).toUpperCase() + insightType.slice(1)} Analysis
              </h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Domain-Scoped Behavioral Report</p>
            </div>
          </div>
          
          {!deepAnalysis ? (
            <div className="flex items-center gap-4 py-6 bg-muted/20 rounded-3xl px-6">
              <Loader className={`h-5 w-5 animate-spin ${
                insightType === 'safety' ? 'text-destructive' :
                insightType === 'learning' ? 'text-primary' :
                'text-secondary'
              }`} />
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest italic">AI is performing focused analysis...</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Top: Focused Analysis Paragraph */}
              <div className="relative">
                <div className={`absolute -left-4 top-0 bottom-0 w-1 rounded-full ${
                  insightType === 'safety' ? 'bg-destructive/20' :
                  insightType === 'learning' ? 'bg-primary/20' :
                  'bg-secondary/20'
                }`} />
                <p className="text-[15px] font-medium text-foreground/80 leading-relaxed italic pl-4">
                  "{deepAnalysis.analysis}"
                </p>
              </div>

              {/* Severity and Signals */}
              <div className="flex flex-wrap items-center gap-4">
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                  deepAnalysis.severity === 'high' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                  deepAnalysis.severity === 'medium' ? 'bg-orange-500/10 text-orange-600 border-orange-500/20' :
                  'bg-mint/10 text-mint border-mint/20'
                }`}>
                  Overall Severity: {deepAnalysis.severity}
                </div>
                
                <div className="flex items-center gap-2">
                  {deepAnalysis.signals.map((signal, i) => (
                    <span key={i} className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                      insightType === 'safety' ? 'bg-destructive/5 text-destructive/70' :
                      insightType === 'learning' ? 'bg-primary/5 text-primary/70' :
                      'bg-secondary/5 text-secondary/70'
                    }`}>
                      {signal}
                    </span>
                  ))}
                </div>
              </div>

              {/* Behavior Pattern Section (New) */}
              {deepAnalysis.pattern?.exists && deepAnalysis.pattern.confidence > 60 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-3xl p-6 border ${
                    insightType === 'safety' ? 'bg-destructive/5 border-destructive/10' :
                    insightType === 'learning' ? 'bg-primary/5 border-primary/10' :
                    'bg-secondary/5 border-secondary/10'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`h-10 w-10 flex items-center justify-center rounded-2xl ${
                      insightType === 'safety' ? 'bg-destructive/20 text-destructive' :
                      insightType === 'learning' ? 'bg-primary/20 text-primary' :
                      'bg-secondary/20 text-secondary'
                    }`}>
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className={`text-sm font-black uppercase tracking-widest ${
                        insightType === 'safety' ? 'text-destructive' :
                        insightType === 'learning' ? 'text-primary' :
                        'text-secondary'
                      }`}>Behavior Pattern Detected</h4>
                      <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest">{deepAnalysis.pattern.type} • {deepAnalysis.pattern.confidence}% Confidence</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold leading-relaxed opacity-80">
                    {deepAnalysis.pattern.explanation}
                  </p>
                </motion.div>
              )}

              {/* Main Section Header for Practical Next Steps */}
              <div className="pt-8 border-t border-muted">
                <div className="flex items-center gap-2 mb-6">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                    insightType === 'safety' ? 'bg-destructive/10 text-destructive' :
                    insightType === 'learning' ? 'bg-primary/10 text-primary' :
                    'bg-secondary/10 text-secondary'
                  }`}>
                    <Lightbulb className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-black text-foreground uppercase tracking-widest">Practical Next Steps for Parent</h4>
                </div>

                <div className="grid gap-3">
                  {deepAnalysis.recommended_actions.map((action, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-start gap-4 p-4 rounded-2xl bg-muted/30 hover:bg-muted/50 transition-colors group"
                    >
                      <div className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-black shadow-sm group-hover:scale-110 transition-transform ${
                        insightType === 'safety' ? 'text-destructive' :
                        insightType === 'learning' ? 'text-primary' :
                        'text-secondary'
                      }`}>
                        {i + 1}
                      </div>
                      <p className="text-sm font-semibold text-foreground/80 leading-snug">{action}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Sentiment Trend */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="p-8 shadow-card border-none bg-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Sparkles className="h-32 w-32 text-primary" />
          </div>
          
          <div className="flex items-center justify-between mb-10 relative z-10">
            <div>
              <h2 className="text-2xl font-black text-foreground tracking-tight">Sentiment trend</h2>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Weekly emotional stability</p>
            </div>
            <div className="px-4 py-2 rounded-2xl bg-mint/10 border border-mint/20">
              <span className="text-xs font-black text-mint uppercase tracking-widest">
                {sentimentTrend[6].score > 80 ? "Stable ✨" : "Volatile 📉"}
              </span>
            </div>
          </div>

          <div className="flex items-end justify-between h-48 gap-4 px-2 relative z-10">
            {sentimentTrend.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-4 group">
                <div className="relative w-full flex flex-col items-center">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${day.score}%` }}
                    transition={{ duration: 1, delay: 0.8 + i * 0.1 }}
                    className={`w-full max-w-[40px] rounded-t-xl transition-all duration-300 ${
                      day.score > 80 ? "bg-mint/40 group-hover:bg-mint" : 
                      day.score > 50 ? "bg-orange-400/40 group-hover:bg-orange-400" : 
                      "bg-destructive/40 group-hover:bg-destructive"
                    }`}
                  />
                  <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-foreground text-background text-[10px] font-black px-2 py-1 rounded-lg">
                    {day.score}%
                  </div>
                </div>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{day.day}</span>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Child Intelligence Map */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="p-8 shadow-card border-none bg-white">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-2xl font-black text-foreground tracking-tight">Intelligence map</h2>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Real-time behavior analysis</p>
            </div>
            {intelligence && (
              <div className="px-4 py-2 rounded-2xl bg-primary/10 border border-primary/20">
                <span className="text-xs font-black text-primary uppercase tracking-widest">Growth score: {intelligence.hybridScore}%</span>
              </div>
            )}
          </div>

          {!intelligence || intelligence.hybridScore === null ? (
            <div className="grid gap-10 lg:grid-cols-2">
              <div className="col-span-full py-20 text-center border-2 border-dashed border-muted rounded-[40px] bg-muted/5">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-muted/20">
                  <Brain className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <h3 className="text-2xl font-black text-foreground tracking-tight mb-2">Not enough data yet</h3>
                <p className="text-sm font-medium text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  Alex needs to interact with the AI to generate growth insights, behavioral scores, and personalized recommendations.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-10 lg:grid-cols-2">
              <div className="space-y-8 py-4">
                {/* Curiosity */}
                <div className="rounded-3xl bg-background p-6 hover:shadow-soft transition-all group">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 flex items-center justify-center rounded-xl bg-primary/20 text-primary group-hover:scale-110 transition-transform">
                        <Brain className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-black text-foreground">Curiosity level</span>
                    </div>
                    <span className="text-sm font-black text-primary">{intelligence.curiosity}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted shadow-inner">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${intelligence.curiosity}%` }}
                      transition={{ duration: 1, delay: 0.7 }}
                      className="h-full rounded-full gradient-hero"
                    />
                  </div>
                  <p className="mt-3 text-[11px] font-medium text-muted-foreground leading-relaxed">
                    {intelligence.reasoning.curiosity}
                  </p>
                </div>

                {/* Math Confidence */}
                <div className="rounded-3xl bg-background p-6 hover:shadow-soft transition-all group">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 flex items-center justify-center rounded-xl bg-secondary/20 text-secondary group-hover:scale-110 transition-transform">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-black text-foreground">Math confidence</span>
                    </div>
                    <span className="text-sm font-black text-secondary">{intelligence.mathConfidence}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted shadow-inner">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${intelligence.mathConfidence}%` }}
                      transition={{ duration: 1, delay: 0.8 }}
                      className="h-full rounded-full bg-secondary"
                    />
                  </div>
                  <p className="mt-3 text-[11px] font-medium text-muted-foreground leading-relaxed">
                    {intelligence.reasoning.mathConfidence}
                  </p>
                </div>

                {/* Attention */}
                <div className="rounded-3xl bg-background p-6 hover:shadow-soft transition-all group">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 flex items-center justify-center rounded-xl bg-accent/20 text-accent-foreground group-hover:scale-110 transition-transform">
                        <Timer className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-black text-foreground">Attention span</span>
                    </div>
                    <span className="text-sm font-black text-accent-foreground">{intelligence.attentionSpan}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted shadow-inner">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${intelligence.attentionSpan}%` }}
                      transition={{ duration: 1, delay: 0.9 }}
                      className="h-full rounded-full bg-accent"
                    />
                  </div>
                  <p className="mt-3 text-[11px] font-medium text-muted-foreground leading-relaxed">
                    {intelligence.reasoning.attentionSpan}
                  </p>
                </div>
              </div>

              <div className="flex flex-col justify-start space-y-6">
                <div className="rounded-[40px] bg-gradient-to-br from-primary/10 via-accent/5 to-secondary/10 p-8 border border-white shadow-soft relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-700">
                    <Brain className="h-32 w-32 text-primary" />
                  </div>
                  
                  <div className="relative z-10 space-y-8">
                    {/* 1. Growth Summary */}
                    <div>
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[18px] bg-white shadow-soft">
                        <Target className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black text-foreground tracking-tight">Growth summary</h3>
                        {intelligence.decisionEngine?.confidence && (
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted/30 px-2 py-1 rounded-md">
                            AI Confidence: {intelligence.decisionEngine.confidence}%
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-primary">{intelligence.hybridScore}%</span>
                        {intelligence.previousScore !== undefined && (
                          <span className={`text-xs font-bold uppercase tracking-widest ${
                            intelligence.hybridScore >= intelligence.previousScore ? 'text-mint' : 'text-destructive'
                          }`}>
                            {intelligence.hybridScore >= intelligence.previousScore ? '📈 +' : '📉 -'}
                            {Math.abs(intelligence.hybridScore - intelligence.previousScore)}% from last session
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 2. Key Insight */}
                    <div className="rounded-3xl bg-white/60 p-5 border border-white/40 backdrop-blur-sm shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                        <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Biggest insight today</span>
                      </div>
                      <p className="text-sm font-bold text-foreground leading-snug">
                        {intelligence.decisionEngine?.topInsight || "Collecting Alex's conversation patterns..."}
                      </p>
                    </div>

                    {/* 2.5 Focus Area (New) */}
                    {intelligence.decisionEngine?.focusArea && (
                      <div className="rounded-3xl bg-destructive/5 p-5 border border-destructive/10">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="h-4 w-4 text-destructive" />
                          <span className="text-[10px] font-black text-destructive uppercase tracking-widest">Needs Attention</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-foreground">{intelligence.decisionEngine.focusArea.metric}</span>
                          <span className="text-sm font-black text-destructive">{intelligence.decisionEngine.focusArea.value}%</span>
                        </div>
                      </div>
                    )}

                    {/* 3. Progress Trend */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Progress trend: {intelligence.decisionEngine?.trend}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(intelligence.decisionEngine?.keyChanges || ["Consistent engagement", "Active curiosity"]).map((change, i) => (
                          <span key={i} className="px-3 py-1 rounded-full bg-white/80 text-[10px] font-bold text-primary border border-primary/10">
                            {change}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 4. Evidence Snapshot */}
                    {intelligence.evidence_messages && intelligence.evidence_messages.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Based on these interactions:</span>
                        </div>
                        <div className="space-y-2">
                          {intelligence.evidence_messages.map((msg, i) => (
                            <div key={i} className="px-4 py-2 rounded-2xl bg-white/40 border border-white/20 italic text-[11px] font-medium text-foreground/70">
                              "{msg}"
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 5. Smart Recommendation */}
                    <div className="pt-6 border-t border-primary/10">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-8 w-8 rounded-xl bg-primary text-white flex items-center justify-center shadow-soft">
                          <Lightbulb className="h-4 w-4" />
                        </div>
                        <h4 className="text-sm font-black text-foreground uppercase tracking-widest">Smart recommendation</h4>
                      </div>
                      <p className="text-sm font-bold text-primary/90 leading-relaxed bg-primary/5 p-4 rounded-2xl border border-primary/10">
                        {intelligence.decisionEngine?.actionPlan || "Analyzing Alex's latest interests to provide personalized guidance."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card className="p-8 shadow-card border-none bg-white">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-black text-foreground tracking-tight">Recent activity</h2>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Alex's Latest Questions</p>
            </div>
            <button 
              onClick={() => navigate("/parent-dashboard/activity")}
              className="text-[11px] font-black text-primary uppercase tracking-widest hover:underline"
            >
              View full log
            </button>
          </div>
          
          {activities.length === 0 ? (
            <div className="rounded-3xl bg-muted/30 p-10 text-center">
              <Sparkles className="mx-auto mb-4 h-10 w-10 text-muted-foreground opacity-50" />
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No conversation logs yet</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {activities.slice(0, 5).map((activity, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + index * 0.08 }}
                  className="group flex items-center justify-between rounded-2xl bg-background p-5 hover:bg-white hover:shadow-soft border border-transparent hover:border-primary/10 transition-all"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-white shadow-card group-hover:bg-primary/10 transition-colors">
                      <MessageSquare className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground leading-snug">{activity.userText}</p>
                      <div className="mt-1.5 flex items-center gap-3">
                        <span className="flex items-center gap-1 text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                          <BookOpen className="h-3 w-3" />
                          {activity.category}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                        <span className="flex items-center gap-1 text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                          <Clock className="h-3 w-3" />
                          {formatTime(activity.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                        activity.status === "safe"
                          ? "bg-primary/10 text-primary"
                          : activity.status === "filtered"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-secondary/10 text-secondary"
                      }`}
                    >
                      {activity.status === "safe" ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : activity.status === "filtered" ? (
                        <AlertCircle className="h-3 w-3" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      {activity.status}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
};

export default DashboardOverview;