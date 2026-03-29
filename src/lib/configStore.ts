/**
 * Global Configuration Store
 * Manages all dynamic configurations stored in localStorage to ensure the app is fully data-driven.
 */

const CONFIG_KEY = "app_dynamic_config";

export interface AppConfig {
  ai: {
    defaultGreeting: string;
    fallbacks: Record<string, string>;
    presets: Record<string, any>;
    defaultConfig: any;
  };
  behavior: {
    moodThresholds: {
      lowEngagement: number;
      emotional: number;
    };
    moodKeywords: {
      lowEngagement: string[];
      emotional: string[];
    };
  };
  gamification: {
    xpMultipliers: {
      base: number;
      quiz: number;
      safety: number;
    };
    badges: Array<{
      id: string;
      label: string;
      condition: string; // Evaluation string or simple key
      threshold: number;
    }>;
  };
  categories: Array<{
    id: string;
    label: string;
    keywords: string[];
    regex?: string;
  }>;
  intelligence: {
    sessionGapMs: number;
    behavioral: {
      consistencyWindowDays: number;
      targetSessionDurationMinutes: number;
      targetInteractionDensity: number;
      recentSessionWindowDays: number;
      dropOffPenalty: number;
    };
    antiGaming: {
      diversityRatioThreshold: number;
      minActivitiesForPenalty: number;
    };
  };
  screenTime: {
    defaultSettings: {
      dailyLimit: number;
      isLocked: boolean;
      restrictionEnabled: boolean;
      mode: string;
    };
  };
  auth: {
    defaultPin: string;
  };
  api: {
    baseUrl: string;
    chat: string;
    intelligence: string;
    decisionEngine: string;
    insights: string;
    deepAnalysis: string;
    fullReport: string;
    model: string;
  };
}

// Support for VITE_API_URL environment variable with fallback for development
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const DEFAULT_CONFIG: AppConfig = {
  ai: {
    defaultGreeting: "Hey there! 🌟 I'm so happy to see you! What would you like to explore today? You can pick one of the buttons below, or ask me anything!",
    fallbacks: {
      "Help me with homework": "Great choice! 📚 What subject are you working on? I can help with math, science, reading, and more. Let's figure it out together!",
      "Tell me a story": "Once upon a time, in a forest made of candy… 🍬 A brave little fox named Pixel discovered a hidden library inside a giant mushroom. Want me to continue? 📖",
      "Explain something": "I love explaining things! 🧠 Pick a topic — like why the sky is blue, how volcanoes work, or what makes rainbows — and I'll break it down for you!",
      "Fun facts": "Did you know? 🎉 Octopuses have THREE hearts and BLUE blood! Two hearts pump blood to their gills, and one pumps it to the rest of the body. How cool is that?",
    },
    presets: {
      "kid-safe": {
        safetyLevel: "strict",
        toggles: {
          strictFiltering: true,
          encourageCuriosity: true,
          keepAnswersShort: true,
          allowStorytelling: true,
          avoidSensitiveTopics: true,
          useSimpleLanguage: true,
        }
      },
      "learning": {
        safetyLevel: "moderate",
        toggles: {
          strictFiltering: true,
          encourageCuriosity: true,
          keepAnswersShort: false,
          allowStorytelling: false,
          avoidSensitiveTopics: true,
          useSimpleLanguage: false,
        }
      },
      "focus": {
        safetyLevel: "moderate",
        toggles: {
          strictFiltering: true,
          encourageCuriosity: false,
          keepAnswersShort: true,
          allowStorytelling: false,
          avoidSensitiveTopics: true,
          useSimpleLanguage: true,
        }
      },
      "creative": {
        safetyLevel: "soft",
        toggles: {
          strictFiltering: false,
          encourageCuriosity: true,
          keepAnswersShort: false,
          allowStorytelling: true,
          avoidSensitiveTopics: false,
          useSimpleLanguage: false,
        }
      }
    },
    defaultConfig: {
      selectedPreset: "kid-safe",
      safetyLevel: "moderate",
      toggles: {
        strictFiltering: true,
        encourageCuriosity: true,
        keepAnswersShort: true,
        allowStorytelling: true,
        avoidSensitiveTopics: true,
        useSimpleLanguage: true,
      },
      customInstructions: "",
    }
  },
  behavior: {
    moodThresholds: {
      lowEngagement: 3,
      emotional: 2,
    },
    moodKeywords: {
      lowEngagement: ["ok", "yes", "k", "fine", "sure"],
      emotional: ["sad", "angry", "bored", "lonely", "mad"],
    }
  },
  gamification: {
    xpMultipliers: {
      base: 10,
      quiz: 25,
      safety: 5,
    },
    badges: [
      { id: "explorer", label: "Explorer 🧭", condition: "total_activities", threshold: 5 },
      { id: "math_wizard", label: "Math Wizard 🔢", condition: "category_math", threshold: 3 },
      { id: "science_whiz", label: "Science Whiz 🧪", condition: "category_science", threshold: 3 },
    ]
  },
  categories: [
    { id: "math", label: "Math", keywords: ["math", "plus", "minus", "divide", "multiply"], regex: "\\d" },
    { id: "science", label: "Science", keywords: ["science", "why", "how", "space", "earth"] },
    { id: "stories", label: "Stories", keywords: ["story", "once upon a time"] },
    { id: "general", label: "General", keywords: [] },
  ],
  intelligence: {
    sessionGapMs: 30 * 60 * 1000,
    behavioral: {
      consistencyWindowDays: 7,
      targetSessionDurationMinutes: 15,
      targetInteractionDensity: 5,
      recentSessionWindowDays: 2,
      dropOffPenalty: 0.7,
    },
    antiGaming: {
      diversityRatioThreshold: 0.4,
      minActivitiesForPenalty: 5,
    },
  },
  screenTime: {
    defaultSettings: {
      dailyLimit: 60,
      isLocked: false,
      restrictionEnabled: true,
      mode: "balanced",
    },
  },
  auth: {
    defaultPin: "1234",
  },
  api: {
    baseUrl: API_BASE_URL,
    chat: "/api/chat",
    intelligence: "/api/analyze-intelligence",
    decisionEngine: "/api/decision-engine",
    insights: "/api/insights",
    deepAnalysis: "/api/deep-analysis",
    fullReport: "/api/generate-full-report",
    model: "llama-3.1-8b-instant",
  },
};

export function getConfig(): AppConfig {
  try {
    const data = localStorage.getItem(CONFIG_KEY);
    if (!data) {
      // Initialize with defaults if not present
      saveConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }
    
    const stored = JSON.parse(data);
    
    // Merge stored config with DEFAULT_CONFIG to ensure all keys exist
    // This handles cases where new config fields were added in updates
    const merged = {
      ...DEFAULT_CONFIG,
      ...stored,
      // Deep merge for nested objects if necessary (ai, behavior, etc)
      ai: { ...DEFAULT_CONFIG.ai, ...stored.ai },
      behavior: { ...DEFAULT_CONFIG.behavior, ...stored.behavior },
      gamification: { ...DEFAULT_CONFIG.gamification, ...stored.gamification },
      intelligence: { ...DEFAULT_CONFIG.intelligence, ...stored.intelligence },
      screenTime: { ...DEFAULT_CONFIG.screenTime, ...stored.screenTime },
      api: { ...DEFAULT_CONFIG.api, ...stored.api },
    };

    return merged;
  } catch (error) {
    console.error("[ConfigStore] Error reading config:", error);
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: AppConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function updateConfig(updates: Partial<AppConfig>): void {
  const current = getConfig();
  saveConfig({ ...current, ...updates });
}
