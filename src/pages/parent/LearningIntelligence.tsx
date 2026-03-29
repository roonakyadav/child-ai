import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { 
  Flame, 
  BookOpen, 
  Brain, 
  Target, 
  Compass, 
  Zap,
  TrendingUp,
  Info,
  Lightbulb
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { getActivity } from "@/lib/activity";
import { getLatestIntelligence, IntelligenceMetrics } from "@/lib/intelligence";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--peach))",
  "hsl(var(--mint))",
  "hsl(var(--lavender))",
  "hsl(var(--sunny))",
];

const LearningIntelligence = () => {
  const [intelligence, setIntelligence] = useState<IntelligenceMetrics | null>(null);
  const activities = getActivity();

  useEffect(() => {
    const fetchIntelligence = async () => {
      try {
        const metrics = await getLatestIntelligence();
        setIntelligence(metrics);
      } catch (error) {
        console.error("[LearningIntelligence] Error fetching intelligence:", error);
      }
    };
    fetchIntelligence();
  }, [activities.length]);

  // Unified Data Source
  const learningData = useMemo(() => {
    if (activities.length === 0) return null;

    const topicsMap: Record<string, number> = {};
    const days = new Set<string>();
    
    activities.forEach(a => {
      topicsMap[a.category] = (topicsMap[a.category] || 0) + 1;
      days.add(new Date(a.timestamp).toDateString());
    });

    const totalQuestions = activities.length;
    const sortedTopics = Object.entries(topicsMap)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / totalQuestions) * 100),
        engagement: Math.min(100, Math.round((count / totalQuestions) * 100) + (count * 2))
      }))
      .sort((a, b) => b.count - a.count);

    const skills = intelligence ? [
      { name: "Critical Thinking", level: intelligence.curiosity || 0 },
      { name: "Problem Solving", level: intelligence.mathConfidence || 0 },
      { name: "Focus & Attention", level: intelligence.attentionSpan || 0 },
      { name: "Behavioral Engagement", level: intelligence.behavioralScore || 0 },
    ] : [];

    return {
      topics: sortedTopics,
      totalQuestions,
      topicsExplored: sortedTopics.length,
      streak: days.size,
      skills,
      topTopic: sortedTopics[0],
      lowestTopic: sortedTopics[sortedTopics.length - 1],
      lowTopics: sortedTopics
        .filter(t => t.percentage < 15)
        .map(t => t.name)
        .join(", ") || "none"
    };
  }, [activities, intelligence]);

  if (!learningData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-card rounded-[40px] shadow-soft border border-white">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <Brain className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Intelligence Gathering...</h2>
        <p className="mt-2 text-sm font-bold text-muted-foreground uppercase tracking-widest italic">Start chatting to activate learning intelligence</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-foreground tracking-tight">Learning Intelligence</h1>
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-1 italic">Real-time AI behavioral & academic analysis</p>
      </div>

      {/* 1. Overview Cards */}
      <div className="grid gap-6 sm:grid-cols-3">
        {[
          { label: "Topics Explored", value: learningData.topicsExplored, icon: BookOpen, color: "bg-primary/10 text-primary" },
          { label: "Total Questions", value: learningData.totalQuestions, icon: Brain, color: "bg-secondary/10 text-secondary" },
          { label: "Learning Streak", value: `${learningData.streak} days 🔥`, icon: Flame, color: "bg-peach/10 text-peach" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-3xl bg-white p-6 shadow-soft border border-white group hover:scale-[1.02] transition-transform"
          >
            <div className={`mb-4 inline-flex rounded-2xl p-3 ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="text-3xl font-black text-foreground">{stat.value}</p>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* 2. Skills & Topic Distribution */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Skill Development (LEFT) */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-[40px] bg-white p-8 border border-white shadow-soft flex flex-col h-full"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-foreground tracking-tight">Skill Development</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest italic">Core competency metrics</p>
            </div>
          </div>
          
          <div className="space-y-8 flex-1 flex flex-col justify-center">
            {learningData.skills.map((skill, i) => (
              <div key={skill.name}>
                <div className="mb-2 flex justify-between items-center">
                  <span className="text-sm font-black text-foreground uppercase tracking-wider">{skill.name}</span>
                  <span className="text-xs font-black text-primary bg-primary/5 px-2 py-1 rounded-lg">{skill.level}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted/30 border border-muted/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${skill.level}%` }}
                    transition={{ delay: 0.2 + i * 0.1, duration: 0.8, ease: "easeOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Topic Distribution (RIGHT) */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-[40px] bg-white p-8 border border-white shadow-soft flex flex-col h-full"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-foreground tracking-tight">Topic Distribution</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest italic">Interests by category</p>
            </div>
          </div>
          
          <div className="h-64 relative flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={learningData.topics}
                  dataKey="percentage"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={60}
                  paddingAngle={5}
                  strokeWidth={0}
                >
                  {learningData.topics.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "none",
                    borderRadius: "20px",
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    fontSize: "12px",
                    fontWeight: "900",
                    textTransform: "uppercase"
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            {learningData.topics.map((t, i) => (
              <div key={t.name} className="flex items-center gap-2 text-[10px] font-black text-foreground uppercase tracking-widest">
                <span className="h-3 w-3 rounded-full shadow-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {t.name}
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* 3. Learning Insights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-[40px] bg-white p-8 border border-white shadow-soft"
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-foreground tracking-tight">Learning Insights</h3>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest italic">Behavior-based cognitive patterns</p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {learningData.topics.map((topic, i) => {
            if (topic.percentage < 15) {
              return (
                <div key={topic.name} className="flex items-start gap-4 p-5 rounded-3xl bg-muted/5 border border-muted/10 group hover:bg-white hover:shadow-soft transition-all">
                  <div className="mt-1 h-2 w-2 rounded-full bg-orange-500 shrink-0" />
                  <p className="text-sm font-bold text-foreground/80 leading-snug">
                    Low engagement in <span className="text-orange-600">{topic.name} ({topic.percentage}%)</span> — opportunity for improvement
                  </p>
                </div>
              );
            }
            if (topic.percentage > 50) {
              return (
                <div key={topic.name} className="flex items-start gap-4 p-5 rounded-3xl bg-muted/5 border border-muted/10 group hover:bg-white hover:shadow-soft transition-all">
                  <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                  <p className="text-sm font-bold text-foreground/80 leading-snug">
                    High concentration in <span className="text-primary">{topic.name} ({topic.percentage}%)</span> — consider balancing with other topics
                  </p>
                </div>
              );
            }
            return null;
          })}
        </div>

        <div className="pt-8 border-t border-muted/20">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
              <Lightbulb className="h-4 w-4" />
            </div>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
              Encourage exploring <span className="text-primary">{learningData.lowTopics}</span> to build a more balanced learning pattern.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LearningIntelligence;
