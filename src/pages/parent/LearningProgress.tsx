import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Flame, BookOpen, Brain, Star } from "lucide-react";
import { getActivity } from "@/lib/activity";
import { getLatestIntelligence, IntelligenceMetrics } from "@/lib/intelligence";

const LearningProgress = () => {
  // State for production-grade intelligence metrics
  const [intelligence, setIntelligence] = useState<IntelligenceMetrics | null>(null);
  
  // Get real data from localStorage
  const activities = getActivity();

  // Fetch Intelligence Metrics
  useEffect(() => {
    const fetchIntelligence = async () => {
      try {
        const metrics = await getLatestIntelligence();
        setIntelligence(metrics);
      } catch (error) {
        console.error("[LearningProgress] Error fetching intelligence:", error);
      }
    };
    fetchIntelligence();
  }, [activities.length]);

  // Compute Topics Explored
  const topics = new Set<string>();
  for (let i = 0; i < activities.length; i++) {
    topics.add(activities[i].category);
  }
  const topicsExplored = topics.size;

  // Compute Total Questions
  const totalQuestions = activities.length;

  // Compute Learning Streak (unique days)
  const days = new Set<string>();
  for (let i = 0; i < activities.length; i++) {
    const day = new Date(activities[i].timestamp).toDateString();
    days.add(day);
  }
  const streak = days.size;

  // Compute Skills from centralized intelligence logic
  const skills = intelligence ? [
    { name: "Critical Thinking", level: intelligence.curiosity },
    { name: "Problem Solving", level: intelligence.mathConfidence },
    { name: "Focus & Attention", level: intelligence.attentionSpan },
    { name: "Behavioral Engagement", level: intelligence.behavioralScore },
  ] : [];

  // Compute Questions per Topic
  const topicCounts: Record<string, number> = {};
  for (let i = 0; i < activities.length; i++) {
    const category = activities[i].category;
    topicCounts[category] = (topicCounts[category] || 0) + 1;
  }

  // Convert to array for display
  const topicData = Object.entries(topicCounts).map(([name, count]) => ({
    name,
    count,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-foreground">Learning Progress</h2>
        <p className="text-sm text-muted-foreground">Track Alex's growth and skill development.</p>
      </div>

      {activities.length === 0 ? (
        <div className="rounded-2xl bg-muted/50 p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <p className="text-base font-semibold text-foreground">Start chatting to track progress</p>
          <p className="mt-2 text-sm text-muted-foreground">Ask questions to see your learning journey</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Topics Explored", value: topicsExplored, icon: BookOpen, color: "bg-primary/10 text-primary" },
              { label: "Total Questions", value: totalQuestions, icon: Brain, color: "bg-secondary/20 text-secondary" },
              { label: "Learning Streak", value: `${streak} days 🔥`, icon: Flame, color: "bg-peach/15 text-foreground" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl bg-card p-5 shadow-card"
              >
                <div className={`mb-3 inline-flex rounded-xl p-2.5 ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <p className="text-2xl font-extrabold text-foreground">{stat.value}</p>
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Skills */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl bg-card p-5 shadow-card"
          >
            <h3 className="mb-4 text-lg font-bold text-foreground">🧩 Skill Development</h3>
            {!intelligence ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-10 bg-muted rounded-xl w-full" />
                <div className="h-10 bg-muted rounded-xl w-full" />
                <div className="h-10 bg-muted rounded-xl w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                {skills.map((skill, i) => (
                  <div key={skill.name}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-semibold text-foreground">{skill.name}</span>
                      <span className="font-bold text-muted-foreground">{skill.level}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${skill.level}%` }}
                        transition={{ delay: 0.4 + i * 0.1, duration: 0.6 }}
                        className="h-full rounded-full gradient-hero"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Questions per Topic */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-2xl bg-card p-5 shadow-card"
          >
            <h3 className="mb-4 text-lg font-bold text-foreground">📚 Questions per Topic</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topicData.map((topic) => (
                <div key={topic.name} className="flex items-center gap-3 rounded-xl bg-background p-3">
                  <Star className="h-4 w-4 text-sunny" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{topic.name}</p>
                    <p className="text-xs text-muted-foreground">{topic.count} questions</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
};

export default LearningProgress;
