import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldCheck, 
  Brain, 
  Zap, 
  Sparkles, 
  Target, 
  Info, 
  Save, 
  Play, 
  MessageSquare,
  Settings2,
  Lock,
  History,
  AlertTriangle,
  ChevronDown,
  Clock
} from "lucide-react";
import { 
  getAIConfig, 
  setAIConfig, 
  DEFAULT_AI_CONFIG, 
  PRESETS, 
  PresetMode, 
  SafetyLevel,
  AIBehaviorConfig
} from "@/lib/policy";
import { askGroq } from "@/lib/groq";

const PolicySettings = () => {
  const [config, setConfig] = useState<AIBehaviorConfig>(getAIConfig());
  const [previewInput, setPreviewInput] = useState("");
  const [previewOutput, setPreviewOutput] = useState("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const handlePresetChange = (preset: PresetMode) => {
    const presetData = PRESETS[preset];
    const newConfig = {
      ...config,
      selectedPreset: preset,
      ...presetData,
      toggles: {
        ...config.toggles,
        ...presetData.toggles
      }
    };
    setConfig(newConfig);
    setAIConfig(newConfig);
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  const handleToggleChange = (key: keyof AIBehaviorConfig["toggles"]) => {
    const newConfig = {
      ...config,
      toggles: {
        ...config.toggles,
        [key]: !config.toggles[key]
      }
    };
    setConfig(newConfig);
    setAIConfig(newConfig);
  };

  const handleSafetyChange = (level: SafetyLevel) => {
    const newConfig = { ...config, safetyLevel: level };
    setConfig(newConfig);
    setAIConfig(newConfig);
  };

  const handleSaveCustom = () => {
    setAIConfig(config);
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  const runPreview = async () => {
    if (!previewInput.trim()) return;
    setIsPreviewLoading(true);
    try {
      // Save current config to localStorage so buildSystemPrompt() can use it
      setAIConfig(config);
      
      // Call the actual AI API via askGroq
      const response = await askGroq(previewInput);
      setPreviewOutput(response || "No response received from the AI.");
    } catch (error) {
      console.error("[Preview] AI Call Failed:", error);
      setPreviewOutput("Error: Failed to fetch AI response. Please check your connection.");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  if (!config) return null;

  return (
    <div className="space-y-8 pb-10">
      <header>
        <h1 className="text-3xl font-black text-foreground tracking-tight">AI Personality & Safety Controls</h1>
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-1">Configure your child's digital mentor</p>
      </header>

      {/* 1. Preset Modes */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Select AI Preset</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(["kid-safe", "learning", "focus", "creative"] as PresetMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => handlePresetChange(mode)}
              className={`flex flex-col items-center p-6 rounded-[32px] border transition-all text-center group relative overflow-hidden ${
                config.selectedPreset === mode 
                  ? "bg-primary text-white border-primary shadow-lg scale-[1.02]" 
                  : "bg-white border-white shadow-soft hover:border-primary/20"
              }`}
            >
              <div className={`mb-4 h-12 w-12 flex items-center justify-center rounded-2xl transition-colors ${
                config.selectedPreset === mode ? "bg-white/20" : "bg-primary/5 text-primary"
              }`}>
                {mode === "kid-safe" && <ShieldCheck className="h-6 w-6" />}
                {mode === "learning" && <Brain className="h-6 w-6" />}
                {mode === "focus" && <Target className="h-6 w-6" />}
                {mode === "creative" && <Sparkles className="h-6 w-6" />}
              </div>
              <span className="text-sm font-black uppercase tracking-widest mb-1">{(mode || "").replace("-", " ")}</span>
              <p className={`text-[10px] font-bold leading-relaxed ${
                config?.selectedPreset === mode ? "text-white/80" : "text-muted-foreground"
              }`}>
                {mode === "kid-safe" && "Maximum safety, simple answers, positive tone."}
                {mode === "learning" && "Deep explanations, curiosity-driven, academic focus."}
                {mode === "focus" && "Short, direct responses, minimal distractions."}
                {mode === "creative" && "Open-ended, storytelling, imaginative output."}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* LEFT SECTION (2 columns on desktop) */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          {/* 2. Control Panel & Safety Slider */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-[40px] bg-white p-8 border border-white shadow-soft"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Settings2 className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-black text-foreground tracking-tight">AI Behavior Toggles</h3>
            </div>

            <div className="grid gap-4">
              {[
                { key: "strictFiltering", label: "Strict Safety Filtering", icon: ShieldCheck },
                { key: "encourageCuriosity", label: "Encourage Curiosity", icon: Zap },
                { key: "keepAnswersShort", label: "Keep Answers Short", icon: Clock },
                { key: "allowStorytelling", label: "Allow Storytelling", icon: History },
                { key: "avoidSensitiveTopics", label: "Avoid Sensitive Topics", icon: AlertTriangle },
                { key: "useSimpleLanguage", label: "Use Simple Language", icon: MessageSquare },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-4 rounded-2xl bg-muted/5 border border-muted/10 group hover:bg-white hover:shadow-soft transition-all">
                  <div className="flex items-center gap-3">
                    <item.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-sm font-bold text-foreground/80">{item.label}</span>
                  </div>
                  <button
                    onClick={() => handleToggleChange(item.key as keyof AIBehaviorConfig["toggles"])}
                    className={`relative h-6 w-11 rounded-full transition-all duration-300 ${
                      config?.toggles?.[item.key as keyof AIBehaviorConfig["toggles"]] ? "bg-primary shadow-sm" : "bg-muted"
                    }`}
                  >
                    <div className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-md transition-all duration-300 ${
                      config?.toggles?.[item.key as keyof AIBehaviorConfig["toggles"]] ? "left-[22px]" : "left-1"
                    }`} />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-10 pt-8 border-t border-muted/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600">
                  <Lock className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-black text-foreground tracking-tight">Safety Guardrail Level</h3>
              </div>
              
              <div className="relative px-2">
                <div className="flex justify-between mb-4">
                  {(["soft", "moderate", "strict"] as SafetyLevel[]).map((level) => (
                    <button
                      key={level}
                      onClick={() => handleSafetyChange(level)}
                      className={`text-[10px] font-black uppercase tracking-widest transition-colors ${
                        config?.safetyLevel === level ? "text-primary" : "text-muted-foreground opacity-50"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <div 
                  className="h-2 rounded-full bg-muted/30 relative cursor-pointer group/track"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const width = rect.width;
                    const percentage = (x / width) * 100;
                    if (percentage < 33) handleSafetyChange("soft");
                    else if (percentage < 66) handleSafetyChange("moderate");
                    else handleSafetyChange("strict");
                  }}
                >
                  <motion.div 
                    className="absolute top-0 h-full rounded-full bg-primary"
                    animate={{ 
                      width: config?.safetyLevel === "soft" ? "0%" : config?.safetyLevel === "moderate" ? "50%" : "100%",
                      left: "0%"
                    }}
                  />
                  <motion.div 
                    className="absolute -top-2 h-6 w-6 rounded-full bg-white border-4 border-primary shadow-md transition-transform group-hover/track:scale-110"
                    animate={{ 
                      left: config?.safetyLevel === "soft" ? "0%" : config?.safetyLevel === "moderate" ? "48%" : "96%"
                    }}
                  />
                </div>
              </div>
              <p className="mt-6 text-xs font-bold text-muted-foreground italic leading-relaxed">
                {config?.safetyLevel === "soft" && "Allows for more open and complex conversations while maintaining core safety filters."}
                {config?.safetyLevel === "moderate" && "Balanced approach suitable for most age groups. Standard filters active."}
                {config?.safetyLevel === "strict" && "Aggressive filtering. Polites redirects for any non-educational or mature topics."}
              </p>
            </div>
          </motion.div>

          {/* 3. Live AI Preview */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-[40px] bg-white p-8 border border-white shadow-soft flex flex-col"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-mint/10 text-mint">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-black text-foreground tracking-tight">Test AI Behavior</h3>
            </div>

            <div className="space-y-6 flex-1 flex flex-col">
              <div className="relative">
                <input
                  type="text"
                  value={previewInput}
                  onChange={(e) => setPreviewInput(e.target.value)}
                  placeholder="Try asking something (e.g., Explain gravity)"
                  className="w-full rounded-2xl border border-muted/20 bg-muted/5 p-4 pr-12 text-sm font-bold text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none transition-colors"
                  onKeyDown={(e) => e.key === "Enter" && runPreview()}
                />
                <button
                  onClick={runPreview}
                  disabled={isPreviewLoading || !previewInput.trim()}
                  className="absolute right-2 top-2 h-10 w-10 flex items-center justify-center rounded-xl bg-primary text-white shadow-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Play className={`h-4 w-4 ${isPreviewLoading ? "animate-pulse" : ""}`} />
                </button>
              </div>

              <div className="rounded-3xl bg-muted/10 border border-muted/5 p-6 relative overflow-hidden flex flex-col min-h-[150px]">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <Brain className="h-20 w-20" />
                </div>
                
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-2 w-2 rounded-full bg-mint animate-pulse" />
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Live Response</span>
                </div>

                <div className="flex-1 overflow-y-auto text-sm font-bold text-foreground/80 leading-relaxed italic custom-scrollbar">
                  {isPreviewLoading ? (
                    <div className="flex flex-col gap-2">
                      <div className="h-4 w-3/4 bg-muted/20 rounded animate-pulse" />
                      <div className="h-4 w-1/2 bg-muted/20 rounded animate-pulse" />
                    </div>
                  ) : previewOutput ? (
                    `"${previewOutput}"`
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 text-center">
                      <Info className="h-10 w-10 mb-2" />
                      <p className="uppercase text-[10px] tracking-widest">Click play to see how the AI responds with current settings</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* 5. Advanced Instructions (Secondary) */}
          <section className="mt-4">
            <motion.button
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={`flex w-full items-center justify-between p-6 rounded-[32px] border transition-all shadow-soft group ${
                isAdvancedOpen ? "bg-secondary text-white border-secondary" : "bg-white border-white hover:border-secondary/20"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 flex items-center justify-center rounded-2xl transition-colors ${
                  isAdvancedOpen ? "bg-white/20" : "bg-secondary/10 text-secondary"
                }`}>
                  <Settings2 className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-black uppercase tracking-widest">Advanced Custom Instructions</h3>
                  <p className={`text-[10px] font-bold mt-0.5 ${isAdvancedOpen ? "text-white/70" : "text-muted-foreground"}`}>
                    Add specific rules and behavioral overrides for the AI
                  </p>
                </div>
              </div>
              <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${isAdvancedOpen ? "rotate-180" : ""}`} />
            </motion.button>

            <AnimatePresence>
              {isAdvancedOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                  animate={{ height: "auto", opacity: 1, marginTop: 16 }}
                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-[40px] bg-white p-8 border border-white shadow-soft">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                          <Settings2 className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-black text-foreground tracking-tight">Custom Override Layer</h3>
                      </div>
                      <button
                        onClick={handleSaveCustom}
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-white text-xs font-black uppercase tracking-widest shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
                      >
                        <Save className="h-4 w-4" />
                        {saveStatus === "saved" ? "Saved!" : "Save Changes"}
                      </button>
                    </div>

                    <textarea
                      value={config?.customInstructions || ""}
                      onChange={(e) => setConfig({ ...config, customInstructions: e.target.value })}
                      placeholder="Example: Always relate science questions to space. Encourage Alex to use his imagination for story prompts."
                      className="w-full h-32 rounded-3xl border border-muted/20 bg-muted/5 p-6 text-sm font-bold text-foreground placeholder:text-muted-foreground/30 focus:border-secondary focus:outline-none transition-colors resize-none"
                    />
                    <p className="mt-4 text-[10px] font-bold text-muted-foreground italic">
                      * Custom instructions will be appended to the AI's system prompt and act as final guidelines.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>

        {/* RIGHT SECTION (Sticky summary) */}
        <div className="lg:col-span-1 lg:sticky lg:top-8">
          {/* 4. Behavior Summary */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[40px] bg-gradient-to-br from-primary/5 via-secondary/5 to-mint/5 p-8 border border-white shadow-soft"
          >
            <div className="flex items-center gap-2 mb-6">
              <History className="h-4 w-4 text-primary" />
              <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Behavior Summary</h2>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-white/50 p-4 rounded-2xl border border-white/50">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Current Mode</p>
                <p className="text-sm font-black text-primary uppercase">{(config?.selectedPreset || "default").replace("-", " ")}</p>
              </div>
              <div className="bg-white/50 p-4 rounded-2xl border border-white/50">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Safety Level</p>
                <p className="text-sm font-black text-orange-600 uppercase">{config?.safetyLevel || "moderate"}</p>
              </div>
              <div className="bg-white/50 p-4 rounded-2xl border border-white/50">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Enabled Styles</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(config?.toggles || {}).filter(([_, v]) => v).map(([k, _]) => (
                    <span key={k} className="px-3 py-1 bg-primary/10 text-primary text-[9px] font-black uppercase rounded-full border border-primary/10">
                      {k.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default PolicySettings;
