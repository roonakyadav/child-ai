import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { getActivity } from "@/lib/activity";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--peach))",
  "hsl(var(--mint))",
  "hsl(var(--lavender))",
  "hsl(var(--sunny))",
];

const InterestMapping = () => {
  // Get real activity data from localStorage
  const activities = getActivity();

  // Count topics from activities
  const topicCounts: Record<string, number> = {};
  for (let i = 0; i < activities.length; i++) {
    const category = activities[i].category;
    if (!topicCounts[category]) {
      topicCounts[category] = 0;
    }
    topicCounts[category]++;
  }

  // Calculate total questions
  let total = 0;
  const keys = Object.keys(topicCounts);
  for (let i = 0; i < keys.length; i++) {
    total += topicCounts[keys[i]];
  }

  // Convert to percentages
  const topicPercentages: Record<string, number> = {};
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    topicPercentages[key] = Math.round((topicCounts[key] / total) * 100);
  }

  // Calculate engagement scores
  const topicEngagement: Record<string, number> = {};
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    // Engagement = percentage + (count * 2), clamped to max 100
    const score = topicPercentages[key] + (topicCounts[key] * 2);
    topicEngagement[key] = Math.max(0, Math.min(100, score));
  }

  // Convert to array format for chart
  const topicData = Object.entries(topicPercentages).map(([key, value]) => ({
    name: key,
    value: value,
    count: topicCounts[key],
    engagement: topicEngagement[key],
  }));

  // Prevent NaN percentage calculation
  const calculatePercentage = (count: number) => {
    if (!total || total === 0) return 0;
    return Math.round((count / total) * 100);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-foreground">Interest Mapping</h2>
        <p className="text-sm text-muted-foreground">Discover what Alex is most curious about.</p>
      </div>

      {total === 0 ? (
        <div className="rounded-2xl bg-muted/50 p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <PieChart className="h-8 w-8 text-primary" />
          </div>
          <p className="text-base font-semibold text-foreground">Start chatting to see interest mapping</p>
          <p className="mt-2 text-sm text-muted-foreground">Ask questions about different topics to see your interests</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Pie Chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-card p-5 shadow-card"
          >
            <h3 className="mb-4 text-lg font-bold text-foreground">🗺️ Topic Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topicData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {topicData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      fontSize: "13px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              {topicData.map((t, i) => (
                <div key={t.name} className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  {t.name}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Engagement Scores */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl bg-card p-5 shadow-card"
          >
            <h3 className="mb-4 text-lg font-bold text-foreground">🎯 Engagement Scores</h3>
            <div className="space-y-4">
              {topicData.map((topic, i) => (
                <div key={topic.name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-semibold text-foreground">{topic.name}</span>
                    <span className="font-bold text-muted-foreground">{topic.engagement}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${topic.engagement}%` }}
                      transition={{ delay: 0.3 + i * 0.1, duration: 0.6 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {topic.count} questions ({calculatePercentage(topic.count)}% of total)
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default InterestMapping;
