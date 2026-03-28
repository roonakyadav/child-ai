import { motion } from "framer-motion";
import { CheckCircle, AlertCircle, FileCheck } from "lucide-react";
import { getActivity, formatTime } from "@/lib/activity";

const statusStyles = {
  safe: { label: "Safe", color: "bg-mint/20 text-mint", icon: CheckCircle },
  filtered: { label: "Filtered", color: "bg-orange-200 text-orange-800", icon: AlertCircle },
  guided: { label: "Guided", color: "bg-blue-200 text-blue-800", icon: FileCheck },
};

const ActivityFeed = () => {
  const activities = getActivity();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-foreground">Activity Feed</h2>
        <p className="text-sm text-muted-foreground">Real conversations between Alex and the AI.</p>
      </div>

      {activities.length === 0 ? (
        <div className="rounded-2xl bg-muted/50 p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle className="h-8 w-8 text-primary" />
          </div>
          <p className="text-base font-semibold text-foreground">No activity yet</p>
          <p className="mt-2 text-sm text-muted-foreground">Start chatting to see conversations</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map((activity, i) => {
            const status = statusStyles[activity.status];
            const StatusIcon = status.icon;

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl bg-card p-5 shadow-card"
              >
                {/* Header Row */}
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${status.color}`}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      {status.label}
                    </span>
                    <span className="rounded-lg bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                      {activity.category}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatTime(activity.timestamp)}</span>
                </div>

                {/* Conversation Content */}
                <div className="space-y-3">
                  {/* Child's Question */}
                  <div className="rounded-xl bg-primary/5 p-4">
                    <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Child asked:</p>
                    <p className="text-sm font-medium text-foreground">{activity.userText}</p>
                  </div>

                  {/* AI Response */}
                  <div className="rounded-xl bg-background p-4">
                    <p className="mb-1.5 text-xs font-semibold text-muted-foreground">AI responded:</p>
                    <p className="text-sm text-foreground leading-relaxed">{activity.aiText}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ActivityFeed;
