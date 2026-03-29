import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { getActivity } from "@/lib/activity";
import { getEngagementIntelligence, EngagementIntelligence } from "@/lib/engagement";
import { 
  TrendingUp, 
  AlertTriangle, 
  Lightbulb, 
  Clock, 
  Calendar, 
  Activity, 
  Zap, 
  Loader 
} from "lucide-react";

const UsageAnalytics = () => {
  const [intelligence, setIntelligence] = useState<EngagementIntelligence | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get real activity data from localStorage
  const activities = getActivity();

  // Group activities by day of week
  const days: Record<string, number> = {
    Mon: 0,
    Tue: 0,
    Wed: 0,
    Thu: 0,
    Fri: 0,
    Sat: 0,
    Sun: 0,
  };

  // Track hours for peak time calculation
  const hours = new Array(24).fill(0);

  // Analyze activities
  for (let i = 0; i < activities.length; i++) {
    const date = new Date(activities[i].timestamp);
    const day = date.toLocaleString("en-US", { weekday: "short" });
    const hour = date.getHours();

    if (days.hasOwnProperty(day)) {
      days[day]++;
    }
    hours[hour]++;
  }

  // Fetch engagement intelligence
  useEffect(() => {
    async function fetchIntelligence() {
      setIsLoading(true);
      const data = await getEngagementIntelligence(activities);
      setIntelligence(data);
      setIsLoading(false);
    }
    fetchIntelligence();
  }, [activities.length]);

  // Convert to minutes (estimate: 2 min per question)
  const dailyMinutes: Record<string, number> = {};
  for (const day in days) {
    dailyMinutes[day] = days[day] * 2;
  }

  // Find peak day
  let peakDay = "";
  let maxMinutes = 0;
  for (const day in dailyMinutes) {
    if (dailyMinutes[day] > maxMinutes) {
      maxMinutes = dailyMinutes[day];
      peakDay = day;
    }
  }

  // Find peak hour
  const maxHourCount = Math.max(...hours);
  let peakHour = hours.indexOf(maxHourCount);

  // Convert to time range (e.g., "3–5 PM")
  function formatTimeRange(hour: number): string {
    if (hour === 0) return "12–2 AM";
    if (hour < 12) return `${hour}–${hour + 2} AM`;
    if (hour === 12) return "12–2 PM";
    const pmHour = hour - 12;
    return `${pmHour}–${pmHour + 2} PM`;
  }

  const peakTimeRange = peakHour >= 0 ? formatTimeRange(peakHour) : "N/A";

  // Calculate average daily usage
  const totalMinutes = Object.values(dailyMinutes).reduce((sum, val) => sum + val, 0);
  const avgMinutes = Math.round(totalMinutes / 7);

  // Calculate number of active days
  const activeDays = Object.values(dailyMinutes).filter(min => min > 0).length;

  // Prepare chart data
  const dailyChartData = Object.entries(dailyMinutes).map(([day, minutes]) => ({
    day,
    minutes,
  }));

  // Group activities by week for real trend
  const weeklyTrend: Record<string, number> = {};
  
  // Get start of current week (Sunday)
  const now = new Date();
  const startOfCurrentWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  startOfCurrentWeek.setHours(0, 0, 0, 0);

  // Analyze last 4 weeks
  for (let i = 0; i < 4; i++) {
    const weekStart = new Date(startOfCurrentWeek);
    weekStart.setDate(weekStart.getDate() - (i * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    const weekLabel = i === 0 ? "This Week" : `${i}w ago`;
    const count = activities.filter(a => {
      const ts = new Date(a.timestamp);
      return ts >= weekStart && ts < weekEnd;
    }).length;
    
    weeklyTrend[weekLabel] = count;
  }

  // Convert to array and reverse for chronological order
  const trendData = Object.entries(weeklyTrend)
    .map(([week, count]) => ({ week, count }))
    .reverse();

  // Single Source of Truth for Analytics Data
  const analyticsData = {
    totalInteractions: activities.length,
    activeDays: Object.values(dailyMinutes).filter(min => min > 0).length,
    sessions: activities.length,
    peakDay: peakDay || "N/A",
    peakTime: peakTimeRange || "N/A",
    avgDailyUse: avgMinutes,
    activityLevel: intelligence?.activityLevel || (activities.length > 20 ? "High" : activities.length > 5 ? "Medium" : "Low"),
    consistencyLevel: intelligence?.consistencyLevel || (Object.values(dailyMinutes).filter(min => min > 0).length > 3 ? "High" : Object.values(dailyMinutes).filter(min => min > 0).length > 1 ? "Medium" : "Low")
  };

  return (
    <div className="space-y-8">
      {/* 1. Header with Intelligence Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Engagement Intelligence</h1>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-1">Advanced behavioral usage analysis</p>
        </div>
        
        {!isLoading && intelligence && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`px-6 py-3 rounded-2xl border flex items-center gap-3 ${
              intelligence.status === "High Engagement" ? "bg-mint/10 border-mint/20 text-mint" :
              intelligence.status === "Moderate Engagement" ? "bg-primary/10 border-primary/20 text-primary" :
              "bg-secondary/10 border-secondary/20 text-secondary"
            }`}
          >
            <div className={`h-3 w-3 rounded-full animate-pulse ${
              intelligence.status === "High Engagement" ? "bg-mint" :
              intelligence.status === "Moderate Engagement" ? "bg-primary" :
              "bg-secondary"
            }`} />
            <span className="text-sm font-black uppercase tracking-widest">{intelligence.status}</span>
          </motion.div>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card rounded-[40px] shadow-soft border border-white">
          <Loader className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest italic">Analyzing behavioral patterns...</p>
        </div>
      ) : (
        <div className="grid gap-8">
          {/* 2. Top Intelligence Row */}
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Status & Behavior Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[40px] bg-white p-8 border border-white shadow-soft space-y-6"
            >
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">Behavior Pattern</span>
                  </div>
                  <h3 className="text-xl font-black text-foreground leading-tight">
                    {(analyticsData.activityLevel === "High" && analyticsData.activeDays === 1) 
                      ? "High activity in a single session" 
                      : (!intelligence?.behaviorPattern || intelligence.behaviorPattern.trim() === "") 
                        ? "Analyzing Behavior..." 
                        : intelligence.behaviorPattern}
                  </h3>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                    Consistency is still developing
                  </p>
                  <p className="text-sm font-medium text-muted-foreground mt-4">
                    {(!intelligence?.statusReason || intelligence.statusReason.trim() === "")
                      ? "We are gathering more data to provide a detailed analysis of the usage patterns."
                      : intelligence.statusReason}
                  </p>
                </div>

                {/* Dual Metrics Display */}
                <div className="flex gap-4 pt-2">
                  <div className="flex-1 rounded-2xl bg-primary/5 p-4 border border-primary/10">
                    <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest mb-1">Activity Level</p>
                    <p className={`text-sm font-black ${
                      analyticsData.activityLevel === 'High' ? 'text-primary' : 
                      analyticsData.activityLevel === 'Medium' ? 'text-orange-500' : 'text-muted-foreground'
                    }`}>
                      {analyticsData.activityLevel}
                    </p>
                  </div>
                  <div className="flex-1 rounded-2xl bg-secondary/5 p-4 border border-secondary/10">
                    <p className="text-[10px] font-black text-secondary/60 uppercase tracking-widest mb-1">Consistency</p>
                    <p className={`text-sm font-black ${
                      analyticsData.consistencyLevel === 'High' ? 'text-secondary' : 
                      analyticsData.consistencyLevel === 'Medium' ? 'text-orange-500' : 'text-muted-foreground'
                    }`}>
                      {analyticsData.consistencyLevel}
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-muted">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Trend Explanation</span>
                  </div>
                  <p className="text-sm font-bold text-foreground/80 italic leading-relaxed bg-muted/30 p-4 rounded-2xl border border-muted/50">
                    "{analyticsData.activeDays === 1 
                      ? `All ${analyticsData.totalInteractions} interactions happened on a single day. No activity was recorded on other days.`
                      : analyticsData.activeDays > 1
                        ? `Activity is spread across ${analyticsData.activeDays} days this week, showing emerging patterns.`
                        : "Not enough data to determine usage patterns."}"
                  </p>
                  {analyticsData.activityLevel === "High" && (
                    <p className="mt-4 text-[11px] font-black text-mint uppercase tracking-widest flex items-center gap-2">
                      <Zap className="h-3 w-3" />
                      The child was highly engaged during this session.
                    </p>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Problems & Actions Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-[40px] bg-gradient-to-br from-primary/5 via-accent/5 to-secondary/5 p-8 border border-white shadow-soft space-y-8"
            >
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Key Engagement Problems</span>
                </div>
                <div className="space-y-3">
                  {(() => {
                    const insights: { text: string; label?: string }[] = [];
                    
                    // 1. Primary Insight (Always first)
                    insights.push({ 
                      text: `${analyticsData.activeDays} active day(s) this week (Target: 4+)`,
                      label: analyticsData.activeDays < 4 ? "Consistency Issue" : undefined
                    });

                    // 2. Secondary Insight (Conditional)
                    if (analyticsData.activeDays === 1) {
                      insights.push({ text: "Activity is currently limited to a single day." });
                    } else if (intelligence?.problems && intelligence.problems.length > 0) {
                      // Add first problem from intelligence if it's not a duplicate of activeDays info
                      const firstProblem = intelligence.problems[0];
                      const isDuplicate = firstProblem.toLowerCase().includes("day") || 
                                        firstProblem.toLowerCase().includes("active") ||
                                        firstProblem.toLowerCase().includes("consistency");
                      
                      if (!isDuplicate) {
                        insights.push({ text: firstProblem });
                      }
                    }

                    // Render max 2 insights
                    return insights.slice(0, 2).map((insight, i) => (
                      <div key={i} className={`flex items-start gap-3 p-3 rounded-2xl border border-white shadow-sm ${i === 0 ? "bg-white/80" : "bg-white/40"}`}>
                        <div className={`h-2 w-2 rounded-full mt-1.5 ${i === 0 ? "bg-orange-500" : "bg-orange-400/60"}`} />
                        <div className="flex flex-col gap-1">
                          {insight.label && (
                            <span className="text-[9px] font-black text-orange-600 uppercase tracking-widest">{insight.label}</span>
                          )}
                          <span className={`${i === 0 ? "text-sm font-black text-foreground" : "text-sm font-bold text-foreground/70"}`}>
                            {insight.text}
                          </span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              <div className="pt-6 border-t border-primary/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-8 w-8 rounded-xl bg-primary text-white flex items-center justify-center shadow-soft">
                    <Lightbulb className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-black text-foreground uppercase tracking-widest">Smart recommendation</h4>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-primary/10 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <Zap className="h-10 w-10 text-primary" />
                  </div>
                  <p className="text-sm font-bold text-primary leading-relaxed relative z-10">
                    {(() => {
                      const hasRecommendation = intelligence?.actionRecommendation && intelligence.actionRecommendation.trim() !== "";
                      if (analyticsData.activityLevel === "High" && analyticsData.consistencyLevel === "Low") {
                        return `The child was highly engaged during the last session. Encourage a short session tomorrow around ${analyticsData.peakTime} to start building a daily habit.`;
                      }
                      if (analyticsData.activityLevel === "Low") {
                        return "The child has low interaction levels. Encourage a short, engaging session to increase usage.";
                      }
                      return hasRecommendation ? intelligence.actionRecommendation : "Encourage consistent daily usage to build a habit.";
                    })()}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* 3. Charts Section (Secondary) */}
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Weekly Activity Line Chart */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-2 rounded-[40px] bg-white p-8 border border-white shadow-soft"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-black text-foreground tracking-tight">Usage Trend</h3>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Interaction volume per week</p>
                </div>
                <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
              <div className={activeDays <= 1 ? "h-[350px] w-full" : "h-[250px] w-full"}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis 
                      dataKey="week" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: "16px", 
                        border: "none", 
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                        fontSize: "12px",
                        fontWeight: "700"
                      }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#8B5CF6" 
                      strokeWidth={4} 
                      dot={{ r: 6, fill: "#8B5CF6", strokeWidth: 2, stroke: "#fff" }} 
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Quick Stats Summary */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-6"
            >
              <div className="rounded-3xl bg-white p-6 border border-white shadow-soft group hover:scale-[1.02] transition-transform">
                <div className="flex items-center gap-3 mb-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Peak Day</span>
                </div>
                <p className="text-2xl font-black text-foreground">{analyticsData.peakDay}</p>
              </div>

              <div className="rounded-3xl bg-white p-6 border border-white shadow-soft group hover:scale-[1.02] transition-transform">
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="h-4 w-4 text-secondary" />
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Peak Time</span>
                </div>
                <p className="text-2xl font-black text-foreground">{analyticsData.peakTime}</p>
              </div>

              <div className="rounded-3xl bg-white p-6 border border-white shadow-soft group hover:scale-[1.02] transition-transform">
                <div className="flex items-center gap-3 mb-2">
                  <Zap className="h-4 w-4 text-mint" />
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Avg Daily Use</span>
                </div>
                <p className="text-2xl font-black text-foreground">{analyticsData.avgDailyUse} min</p>
              </div>
            </motion.div>
          </div>

          {/* 4. Daily Breakdown Chart */}
          {activeDays > 1 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-[40px] bg-white p-8 border border-white shadow-soft"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-black text-foreground tracking-tight">Daily Interaction Breakdown</h3>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Usage minutes across the week</p>
                </div>
                <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-mint/10 text-mint">
                  <Calendar className="h-5 w-5" />
                </div>
              </div>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis 
                      dataKey="day" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ 
                        borderRadius: "16px", 
                        border: "none", 
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                        fontSize: "12px",
                        fontWeight: "700"
                      }} 
                    />
                    <Bar 
                      dataKey="minutes" 
                      fill="#10B981" 
                      radius={[8, 8, 8, 8]} 
                      barSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};

export default UsageAnalytics;
