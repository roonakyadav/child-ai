const z = require('zod');

// --- Constants for validation limits ---

const MAX_MESSAGE_COUNT = 50;
const MAX_MESSAGE_LENGTH = 10000;
const MAX_STRING_LENGTH = 5000;
const MAX_ARRAY_LENGTH = 100;
const MAX_SUMMARY_KEYS = 50;

// Supported AI models
const SUPPORTED_MODELS = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile'
];

// --- Base Schemas ---

const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(MAX_MESSAGE_LENGTH)
});

// --- Endpoint Schemas ---

// POST /api/auth/parent/login, setup, update
const loginSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits')
}).strict();

// POST /api/chat
const chatSchema = z.object({
  messages: z.array(messageSchema).min(1).max(MAX_MESSAGE_COUNT),
  model: z.enum(SUPPORTED_MODELS).optional()
}).strict();

// POST /api/insights
const insightsSchema = z.object({
  summary: z.object({
    topTopics: z.array(z.union([z.string(), z.object({
      name: z.string(),
      count: z.number()
    })])).max(20).optional(),
    recentQuestions: z.array(z.string()).max(20).optional(),
    totalUsageMinutes: z.number().optional()
  }).refine(val => Object.keys(val).length > 0, 'Summary cannot be empty')
    .refine(val => Object.keys(val).length <= MAX_SUMMARY_KEYS, 'Summary has too many keys')
}).strict();

// POST /api/deep-analysis
const deepAnalysisSchema = z.object({
  insight: z.string().min(1).max(MAX_STRING_LENGTH),
  summary: z.record(z.any()).refine(val => Object.keys(val).length > 0, 'Summary cannot be empty'),
  flaggedMessage: z.string().max(MAX_STRING_LENGTH).optional(),
  recentContext: z.array(z.any()).max(MAX_ARRAY_LENGTH).optional(),
  insightType: z.enum(['safety', 'learning', 'engagement'])
}).strict();

// POST /api/analyze-intelligence
const analyzeIntelligenceSchema = z.object({
  messages: z.array(z.any()).min(1).max(MAX_ARRAY_LENGTH)
}).strict();

// POST /api/detect-risk
const detectRiskSchema = z.object({
  message: z.string().min(1).max(MAX_STRING_LENGTH)
}).strict();

// POST /api/analyze-pattern
const analyzePatternSchema = z.object({
  messages: z.array(z.any()).min(1).max(MAX_ARRAY_LENGTH)
}).strict();

// POST /api/decision-engine
const decisionEngineSchema = z.object({
  metrics: z.object({
    curiosity: z.number().optional(),
    mathConfidence: z.number().optional(),
    attentionSpan: z.number().optional()
  }).refine(val => Object.keys(val).length > 0, 'Metrics cannot be empty'),
  history: z.array(z.any()).max(MAX_ARRAY_LENGTH).optional()
}).strict();

// POST /api/analyze-engagement
const analyzeEngagementSchema = z.object({
  usageData: z.object({
    totalActivities: z.number().optional(),
    activeDays: z.number().optional()
  }).refine(val => Object.keys(val).length > 0, 'Usage data cannot be empty'),
  sessionSummary: z.record(z.any()).optional()
}).strict();

// POST /api/analyze-sentiment
const analyzeSentimentSchema = z.object({
  message: z.string().min(1).max(MAX_STRING_LENGTH)
}).strict();

// POST /api/analyze-early-risk
const analyzeEarlyRiskSchema = z.object({
  messages: z.array(z.any()).min(1).max(MAX_ARRAY_LENGTH)
}).strict();

// POST /api/generate-full-report
const generateFullReportSchema = z.object({
  allData: z.object({
    extractedData: z.record(z.any()).refine(val => Object.keys(val).length > 0, 'Extracted data cannot be empty'),
    childName: z.string().max(100).optional()
  }).refine(val => Object.keys(val).length > 0, 'allData cannot be empty')
}).strict();

// PUT /api/config/parent
const screenTimeSchema = z.object({
  dailyLimit: z.number().int().min(0).max(1440).optional(),
  isLocked: z.boolean().optional(),
  restrictionEnabled: z.boolean().optional(),
  mode: z.enum(['strict', 'balanced', 'learning']).optional()
}).strict();

const togglesSchema = z.object({
  strictFiltering: z.boolean().optional(),
  encourageCuriosity: z.boolean().optional(),
  keepAnswersShort: z.boolean().optional(),
  allowStorytelling: z.boolean().optional(),
  avoidSensitiveTopics: z.boolean().optional(),
  useSimpleLanguage: z.boolean().optional()
}).strict();

const aiBehaviorSchema = z.object({
  selectedPreset: z.enum(['kid-safe', 'learning', 'focus', 'creative']).optional(),
  safetyLevel: z.enum(['soft', 'moderate', 'strict']).optional(),
  strictMode: z.boolean().optional(),
  toggles: togglesSchema.optional(),
  customInstructions: z.string().max(5000).optional(),
  parentPolicies: z.array(z.string().max(500)).max(50).optional()
}).strict();

const parentConfigUpdateSchema = z.object({
  screenTime: screenTimeSchema.optional(),
  aiBehavior: aiBehaviorSchema.optional()
}).strict().refine(val => Object.keys(val).length > 0, 'Must provide at least one configuration section to update');

// POST /api/config/parent/migrate
const parentConfigMigrateSchema = z.object({
  screenTime: screenTimeSchema.optional(),
  aiBehavior: aiBehaviorSchema.optional(),
  parentPolicy: z.string().max(5000).optional(),
  parentPolicies: z.array(z.string().max(500)).max(50).optional(),
  strictMode: z.boolean().optional()
}).strict();

// --- Schema Export ---

const schemas = {
  login: loginSchema,
  chat: chatSchema,
  insights: insightsSchema,
  deepAnalysis: deepAnalysisSchema,
  analyzeIntelligence: analyzeIntelligenceSchema,
  detectRisk: detectRiskSchema,
  analyzePattern: analyzePatternSchema,
  decisionEngine: decisionEngineSchema,
  analyzeEngagement: analyzeEngagementSchema,
  analyzeSentiment: analyzeSentimentSchema,
  analyzeEarlyRisk: analyzeEarlyRiskSchema,
  generateFullReport: generateFullReportSchema,
  parentConfigUpdate: parentConfigUpdateSchema,
  parentConfigMigrate: parentConfigMigrateSchema
};

module.exports = { schemas };
