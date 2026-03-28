export type AIMode = "learning" | "fun" | "exploration" | "focus";

export interface ModeConfig {
  id: AIMode;
  label: string;
  icon: string;
  tone: string;
  response_style: string;
  difficulty: "adaptive" | "easy" | "moderate" | "challenging";
  allow_fun: boolean;
  allow_sensitive_topics: boolean;
  max_response_length: "short" | "medium" | "long";
  system_instructions: string;
  suggestions: string[];
}

export const MODES: Record<AIMode, ModeConfig> = {
  learning: {
    id: "learning",
    label: "Learning Mode",
    icon: "🧠",
    tone: "educational",
    response_style: "structured",
    difficulty: "adaptive",
    allow_fun: false,
    allow_sensitive_topics: false,
    max_response_length: "medium",
    system_instructions: "You are an AI tutor in LEARNING MODE. Explain concepts step-by-step, ask follow-up questions to test understanding, and encourage the child to think critically. Use simple but accurate language.",
    suggestions: ["Solve a math problem 🔢", "Explain a concept 💡", "Help with homework 📚", "Quiz me 🎓"]
  },
  fun: {
    id: "fun",
    label: "Fun Mode",
    icon: "🎨",
    tone: "playful",
    response_style: "engaging",
    difficulty: "easy",
    allow_fun: true,
    allow_sensitive_topics: false,
    max_response_length: "short",
    system_instructions: "You are a playful AI companion in FUN MODE. Focus on telling stories, jokes, and sharing fun facts. Use lots of emojis, keep responses short and exciting, and be very encouraging.",
    suggestions: ["Tell me a joke 😂", "Fun fact 🎈", "Riddle me 🧩", "Tell me a story 📖", "Weird science fact 🧪", "Guessing game 🕵️"]
  },
  exploration: {
    id: "exploration",
    label: "Exploration Mode",
    icon: "🌍",
    tone: "curious",
    response_style: "inquiry-based",
    difficulty: "adaptive",
    allow_fun: true,
    allow_sensitive_topics: false,
    max_response_length: "long",
    system_instructions: "You are a curiosity-driven AI in EXPLORATION MODE. Encourage the child to ask 'why' and 'how'. Suggest related topics to dive deeper into, and foster a sense of wonder about the world and science.",
    suggestions: ["How does it work? ⚙️", "Why is the sky blue? ☁️", "Explore space 🚀", "Deep sea animals 🌊"]
  },
  focus: {
    id: "focus",
    label: "Focus Mode",
    icon: "🎯",
    tone: "direct",
    response_style: "minimal",
    difficulty: "moderate",
    allow_fun: false,
    allow_sensitive_topics: false,
    max_response_length: "short",
    system_instructions: "You are a focused AI assistant in FOCUS MODE. Provide direct, short, and accurate answers without distractions like jokes or long stories. Ideal for quick homework checks or specific questions.",
    suggestions: ["Quick check ✏️", "Definition 📚", "Summarize this 📝", "Fact check 🔍"]
  }
};
