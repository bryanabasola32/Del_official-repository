import type { TaskType } from '@/services/models/TaskTypes';

export type IntentType =
  | 'research_executive'
  | 'recommend_events'
  | 'generate_invitation'
  | 'summarize_intelligence'
  | 'explain_recommendation'
  | 'refresh_intelligence'
  | 'company_analysis'
  | 'general_question'
  | 'list_executives'
  | 'list_events';

export interface DetectedIntent {
  type: IntentType;
  taskType: TaskType;
  executiveName: string | null;
  companyName: string | null;
  eventName: string | null;
  confidence: number;
  isFollowUp: boolean;
}

const PRONOUN_PATTERN = /\b(?:him|her|them|this\s+executive|that\s+executive|this\s+person|this\s+guy|the\s+executive|the\s+guy)\b/i;
const CONTINUATION_PATTERN = /\b(?:ok\s+proceed|proceed|continue|go\s+ahead|yes|yeah|sure|ok|do\s+it|research\s+further|tell\s+me\s+more|what\s+did\s+you\s+find|what\s+did\s+you\s+get|what\s+have\s+you\s+found|what\s+are\s+(?:his|her|their)\s+\w+|what\s+about\s+(?:him|her|them|his|her|their)|explain\s+(?:his|her|their)\s+profile|show\s+me\s+more|give\s+me\s+more\s+information|research\s+(?:him|her|them)|what\s+about\s+(?:his|her|their)\s+technology\s+interests|what\s+are\s+(?:his|her|their)\s+priorities)\b/i;

export function detectIntent(prompt: string, conversationContext?: { activeExecutiveName: string | null }): DetectedIntent {
  const lower = prompt.toLowerCase();

  // Extract executive name — patterns like "Research <Name>", "Analyze <Name>", "who is <Name>"
  // Supports middle initials (e.g. "Fabian S. Dee") and multi-word names.
  // Case-insensitive to handle "fabian dee", "FABIAN DEE", "Fabian-S-Dee" etc.
  const namePart = '(?:[a-z]+|[a-z]\\.?)';
  const nameGroup = `(${namePart}(?:[\\s-]+${namePart})+)`;
  const STOP_WORDS = new Set(['the', 'a', 'an', 'this', 'that', 'his', 'her', 'their', 'them', 'him', 'all', 'some', 'any', 'for', 'about', 'who', 'what', 'why', 'how', 'when', 'where', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'shall', 'not', 'no', 'yes', 'ok', 'please', 'and', 'or', 'but', 'so', 'if', 'then', 'else', 'more', 'less', 'most', 'least', 'very', 'too', 'also', 'just', 'only', 'even', 'still', 'already', 'yet', 'now', 'here', 'there', 'out', 'up', 'down', 'over', 'under', 'into', 'from', 'with', 'without', 'by', 'at', 'on', 'off', 'to', 'of', 'in', 'as', 'it', 'its', 'we', 'us', 'our', 'you', 'your', 'my', 'me', 'mine', 'yours', 'hers', 'theirs', 'executive', 'executives', 'company', 'event', 'events', 'intelligence', 'persona', 'profile', 'data', 'research', 'analyze', 'investigate', 'look', 'find', 'generate', 'create', 'build', 'summarize', 'summarize', 'recommend', 'suggest', 'suitable', 'refresh', 'update', 'stale', 'outdated', 'list', 'show', 'display', 'pending', 'insufficient', 'right', 'proceed', 'continue', 'ahead', 'further', 'tell', 'give', 'explain']);
  const namePatterns = [
    new RegExp(`(?:research|analyze|investigate|look\\s+up|find|profile)\\s+(?:executive\\s+)?(?:named\\s+)?${nameGroup}`, 'i'),
    new RegExp(`(?:who\\s+is|tell\\s+me\\s+about|what\\s+do\\s+you\\s+know\\s+about)\\s+${nameGroup}`, 'i'),
    new RegExp(`(?:generate|create|build)\\s+(?:intelligence|profile|persona)\\s+for\\s+${nameGroup}`, 'i'),
  ];
  let executiveName: string | null = null;
  for (const pattern of namePatterns) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      const rawName = match[1].trim();
      const tokens = rawName.split(/[\s-]+/).filter((t) => t.length > 0);
      const filtered = tokens.filter((t) => !STOP_WORDS.has(t.toLowerCase().replace(/\./g, '')));
      if (filtered.length >= 2) {
        executiveName = filtered.join(' ');
        break;
      } else if (filtered.length === 1 && tokens.length >= 2) {
        executiveName = filtered.join(' ');
        break;
      }
    }
  }

  // If no explicit name found, try pronoun/continuation resolution from conversation context
  let isFollowUp = false;
  if (!executiveName && conversationContext?.activeExecutiveName) {
    if (PRONOUN_PATTERN.test(prompt) || CONTINUATION_PATTERN.test(prompt)) {
      executiveName = conversationContext.activeExecutiveName;
      isFollowUp = true;
    }
  }

  // Extract company name
  const companyMatch = prompt.match(/(?:company|at|from)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/);
  const companyName = companyMatch?.[1] || null;

  // Extract event name
  const eventMatch = prompt.match(/(?:event|conference|summit)\s+(?:called\s+|named\s+)?["""]?(.+?)["""]?(?:\s+(?:for|to|with)\s|$)/i);
  const eventName = eventMatch?.[1] || null;

  // Classify intent
  let type: IntentType = 'general_question';
  let taskType: TaskType = 'executive_summary';
  let confidence = 0.5;

  if (/(refresh|update|stale|outdated|re-?research)/.test(lower)) {
    type = 'refresh_intelligence';
    taskType = 'executive_summary';
    confidence = 0.85;
  } else if (/(recommend|suggest|suitable|best\s+event|which\s+event|attendee|match)/.test(lower)) {
    type = 'recommend_events';
    taskType = 'recommendation_generation';
    confidence = 0.85;
  } else if (/(invite|invitation|draft|email|outreach)/.test(lower)) {
    type = 'generate_invitation';
    taskType = 'invitation_writing';
    confidence = 0.85;
  } else if (/(summarize|summary|recent|latest|update\s+me|brief)/.test(lower)) {
    type = 'summarize_intelligence';
    taskType = 'summarization';
    confidence = 0.8;
  } else if (/(why|explain|reason|justification|high.?priority|lead)/.test(lower)) {
    type = 'explain_recommendation';
    taskType = 'strategic_reasoning';
    confidence = 0.8;
  } else if (/(company|competitor|market|industry\s+analysis)/.test(lower)) {
    type = 'company_analysis';
    taskType = 'company_analysis';
    confidence = 0.8;
  } else if (/(research|generate|analyze|investigate|look\s+up|find|profile|persona|who\s+is|tell\s+me\s+about)/.test(lower)) {
    type = 'research_executive';
    taskType = 'executive_intelligence';
    confidence = 0.9;
  } else if (/(list|show|display|all\s+executives|contacts)/.test(lower)) {
    type = 'list_executives';
    taskType = 'executive_summary';
    confidence = 0.7;
  } else if (/(list|show|display|all\s+events|upcoming)/.test(lower)) {
    type = 'list_events';
    taskType = 'executive_summary';
    confidence = 0.7;
  }

  // If this is a follow-up with a resolved executive, classify as research_executive
  if (isFollowUp && executiveName && type === 'general_question') {
    if (/(research|analyze|investigate|look\s+up|find|profile|persona|research\s+(?:him|her|them)|research\s+further)/.test(lower)) {
      type = 'research_executive';
      taskType = 'executive_intelligence';
      confidence = 0.85;
    } else if (/(what\s+did\s+you\s+find|what\s+did\s+you\s+get|what\s+have\s+you\s+found|what\s+are\s+(?:his|her|their)|tell\s+me\s+more|what\s+about|explain\s+(?:his|her|their)|show\s+me\s+more|give\s+me\s+more)/.test(lower)) {
      type = 'explain_recommendation';
      taskType = 'strategic_reasoning';
      confidence = 0.8;
    } else if (/(proceed|continue|go\s+ahead|yes|yeah|sure|ok|do\s+it)/.test(lower)) {
      type = 'research_executive';
      taskType = 'executive_intelligence';
      confidence = 0.8;
    }
  }

  return { type, taskType, executiveName, companyName, eventName, confidence, isFollowUp };
}

export const THINKING_STAGES = {
  understanding: { label: 'Understanding request', icon: 'brain' },
  memoryCheck: { label: 'Checking memory for existing intelligence', icon: 'database' },
  cached: { label: 'Retrieving cached intelligence', icon: 'check' },
  research: { label: 'Executing research pipeline', icon: 'search' },
  search: { label: 'Search agent gathering sources', icon: 'globe' },
  reading: { label: 'Reader agent processing content', icon: 'file-text' },
  evidence: { label: 'Collecting and verifying evidence', icon: 'shield' },
  trust: { label: 'Trust engine evaluating sources', icon: 'award' },
  prompt: { label: 'Building AI prompt with evidence', icon: 'code' },
  routing: { label: 'Intelligence router selecting provider', icon: 'cpu' },
  generating: { label: 'AI provider generating intelligence', icon: 'sparkles' },
  citations: { label: 'Mapping citations and sources', icon: 'link' },
  saving: { label: 'Saving results to knowledge store', icon: 'save' },
  complete: { label: 'Response ready', icon: 'check-circle' },
} as const;

export type ThinkingStageKey = keyof typeof THINKING_STAGES;

export interface ThinkingStage {
  key: ThinkingStageKey;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'skipped';
  timestamp?: number;
  detail?: string;
}

export function getStagesForIntent(
  intent: DetectedIntent,
  hasExistingIntelligence: boolean,
): ThinkingStage[] {
  const stages: ThinkingStage[] = [
    { key: 'understanding', label: THINKING_STAGES.understanding.label, status: 'pending' },
    { key: 'memoryCheck', label: THINKING_STAGES.memoryCheck.label, status: 'pending' },
  ];

  if (hasExistingIntelligence) {
    stages.push({ key: 'cached', label: THINKING_STAGES.cached.label, status: 'pending' });
  } else if (
    intent.type === 'research_executive' ||
    intent.type === 'refresh_intelligence'
  ) {
    stages.push(
      { key: 'research', label: THINKING_STAGES.research.label, status: 'pending' },
      { key: 'search', label: THINKING_STAGES.search.label, status: 'pending' },
      { key: 'reading', label: THINKING_STAGES.reading.label, status: 'pending' },
      { key: 'evidence', label: THINKING_STAGES.evidence.label, status: 'pending' },
      { key: 'trust', label: THINKING_STAGES.trust.label, status: 'pending' },
    );
  }

  stages.push(
    { key: 'prompt', label: THINKING_STAGES.prompt.label, status: 'pending' },
    { key: 'routing', label: THINKING_STAGES.routing.label, status: 'pending' },
    { key: 'generating', label: THINKING_STAGES.generating.label, status: 'pending' },
  );

  if (
    intent.type === 'research_executive' ||
    intent.type === 'refresh_intelligence' ||
    intent.type === 'company_analysis'
  ) {
    stages.push({ key: 'citations', label: THINKING_STAGES.citations.label, status: 'pending' });
    stages.push({ key: 'saving', label: THINKING_STAGES.saving.label, status: 'pending' });
  }

  stages.push({ key: 'complete', label: THINKING_STAGES.complete.label, status: 'pending' });

  return stages;
}
