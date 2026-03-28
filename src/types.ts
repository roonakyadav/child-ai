export type Alert = { 
   id: string; 
   message: string; 
   severity: "low" | "medium" | "high"; 
   category: string; 
   reason: string; 
   timestamp: number; 
   handled: boolean; 
   type?: "risk" | "early_warning";
 }; 

export type InterventionMode = "normal" | "support" | "strict";

export type EarlyRisk = {
  early_risk: boolean;
  risk_type: "emotional_build_up" | "frustration" | "confusion" | "none";
  severity: "low" | "medium";
  confidence: number;
  explanation: string;
};

export type Intervention = {
  id: string;
  type: "calm" | "strict" | "guide";
  timestamp: number;
  related_alert_id: string;
  messages_before: { text: string; timestamp: number }[];
  messages_after: { text: string; timestamp: number }[];
  outcome?: InteractionOutcome;
};

export type InteractionOutcome = {
  outcome: "improved" | "unchanged" | "worsened";
  confidence: number;
  explanation: string;
};

export interface QuizData {
  question: string;
  options: { label: string; text: string }[];
  correct_answer: string;
}

export interface InteractionContext {
  type: "quiz" | "story" | null;
  quiz?: QuizData;
  metadata?: any;
}
