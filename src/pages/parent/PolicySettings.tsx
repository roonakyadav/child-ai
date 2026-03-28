import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Save, RotateCcw } from "lucide-react";
import { getPolicy, setPolicy } from "@/lib/policy";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const PolicySettings = () => {
  const [policy, setLocalPolicy] = useState("");
  const [saved, setSaved] = useState(false);

  // Load existing policy on mount
  useEffect(() => {
    const savedPolicy = getPolicy();
    if (savedPolicy) {
      setLocalPolicy(savedPolicy);
    }
  }, []);

  const handleSave = () => {
    setPolicy(policy);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    setLocalPolicy("");
    setPolicy("");
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-foreground">AI Behavior Settings</h2>
        <p className="text-sm text-muted-foreground">
          Customize how the AI assistant responds to your child.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-card p-6 shadow-card"
      >
        <div className="mb-4">
          <label className="mb-2 block text-sm font-semibold text-foreground">
            Custom Instructions
          </label>
          <Textarea
            value={policy}
            onChange={(e) => setLocalPolicy(e.target.value)}
            placeholder={`Example:
• Keep answers short and simple
• Avoid scary or violent content
• Encourage curiosity and creativity
• Use examples from nature
• Always be positive and supportive`}
            className="min-h-[200px] resize-y text-sm leading-relaxed"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            These instructions will be applied to every AI response. Be specific about tone,
            content preferences, and educational goals.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            Save Policy
          </Button>
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Clear Policy
          </Button>
          {saved && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-sm font-medium text-mint"
            >
              ✓ Saved successfully!
            </motion.span>
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl bg-muted/50 p-6"
      >
        <h3 className="mb-3 text-sm font-bold text-foreground">💡 Tips for Effective Policies</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="mt-1 text-mint">•</span>
            <span>Be specific about response length (e.g., "Keep answers under 3 sentences")</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 text-mint">•</span>
            <span>Set content boundaries (e.g., "No horror or violence topics")</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 text-mint">•</span>
            <span>Define teaching style (e.g., "Explain like a friendly teacher")</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 text-mint">•</span>
            <span>Encourage specific interests (e.g., "Focus on science and nature")</span>
          </li>
        </ul>
      </motion.div>
    </div>
  );
};

export default PolicySettings;
