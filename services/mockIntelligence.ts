import type { Contact } from '@/lib/types';
import type { EvidenceContext } from './research/EvidenceContextBuilder';
import type { ConfidenceAssessment } from './research/ConfidencePropagator';
import type { CitationMap } from './research/CitationMapper';
import type { ExplainabilityReport } from './research/ExplainabilityLayer';
import { EvidenceContextBuilder } from './research/EvidenceContextBuilder';
import { PromptBuilder } from './research/PromptBuilder';
import { ConfidencePropagator } from './research/ConfidencePropagator';
import { CitationMapper } from './research/CitationMapper';
import { ExplainabilityLayer } from './research/ExplainabilityLayer';
import type { EvidencePackage, EvidenceSource } from './research/EvidencePackage';
import { createEvidencePackage } from './research/EvidencePackage';
import type { Fact } from './research/Fact';
import { createFact } from './research/Fact';
import type { SynthesizedPersona } from './providers/types';
import { SynthesizerAgent } from './agents/synthesizer';

/*
 * Mock Intelligence Generator
 *
 * Generates realistic AI-style intelligence data for an executive.
 * This is a placeholder until real AI integration is connected.
 * The data structure matches what the real pipeline would produce.
 */

const PERSONA_TYPES = [
  'Strategic Innovator',
  'Growth-Oriented Executive',
  'Risk-Aware Decision Maker',
  'Operational Optimizer',
  'Customer Experience Champion',
  'Technology Transformation Leader',
  'Data-Driven Strategist',
  'Digital Pioneer',
];

const DECISION_STYLES = [
  'Data-driven',
  'Consensus Builder',
  'Fast Decision Maker',
  'Risk Averse',
  'Innovation Focused',
  'Relationship Driven',
];

const PAIN_POINTS = [
  'Digital transformation and legacy system modernization',
  'Customer retention in an increasingly competitive market',
  'Talent acquisition and retention for specialized technology roles',
  'Data modernization and breaking down organizational silos',
  'Cybersecurity threats and regulatory compliance pressure',
  'Cost optimization while maintaining operational excellence',
  'Cloud migration complexity and vendor lock-in concerns',
  'AI adoption strategy and building internal capabilities',
];

const INITIATIVES = [
  'Cloud migration and infrastructure modernization',
  'AI and machine learning adoption across business units',
  'Market expansion into Southeast Asian markets',
  'Cost optimization through process automation',
  'ESG and sustainability reporting programs',
  'Cybersecurity infrastructure hardening',
  'Digital customer experience platform overhaul',
  'Data warehouse and analytics platform consolidation',
];

const INTERESTS = [
  'Artificial Intelligence',
  'Leadership Development',
  'Digital Banking',
  'Cybersecurity',
  'Innovation',
  'Sustainability',
  'Cloud Architecture',
  'Data Analytics',
  'Digital Transformation',
  'Fintech Partnerships',
];

function seedRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return h / 0x7fffffff;
  };
}

function pick<T>(arr: T[], rand: () => number, count: number): T[] {
  const shuffled = [...arr].sort(() => rand() - 0.5);
  return shuffled.slice(0, count);
}

export interface MockIntelligence {
  persona_type: string;
  decision_style: string;
  executive_summary: string;
  tech_readiness_level: 'High' | 'Medium' | 'Low';
  tech_readiness_explanation: string;
  pain_points: string[];
  initiatives: string[];
  interests: string[];
  sources_verified_count: number;
  confidence_pct: number;
  confidence_level: 'high' | 'medium' | 'low';
}

export function generateMockIntelligence(contact: Pick<Contact, 'id' | 'name' | 'title' | 'company'>): MockIntelligence {
  const rand = seedRandom(contact.id);

  const personaType = PERSONA_TYPES[Math.floor(rand() * PERSONA_TYPES.length)];
  const decisionStyle = DECISION_STYLES[Math.floor(rand() * DECISION_STYLES.length)];
  const painPoints = pick(PAIN_POINTS, rand, 3);
  const initiatives = pick(INITIATIVES, rand, 3);
  const interests = pick(INTERESTS, rand, 4);

  const readinessRoll = rand();
  const techReadinessLevel: 'High' | 'Medium' | 'Low' =
    readinessRoll > 0.65 ? 'High' : readinessRoll > 0.3 ? 'Medium' : 'Low';

  const sourcesVerified = Math.floor(rand() * 6) + 3;
  const confidencePct = Math.floor(rand() * 30) + 65;
  const confidenceLevel: 'high' | 'medium' | 'low' =
    confidencePct >= 85 ? 'high' : confidencePct >= 70 ? 'medium' : 'low';

  const techExplanation = techReadinessLevel === 'High'
    ? 'Active cloud migration program with confirmed vendor partnerships. Implementation-stage readiness with dedicated digital transformation budget.'
    : techReadinessLevel === 'Medium'
    ? 'Ongoing cloud assessment with pilot programs in select business units. Evaluation-stage readiness with planned investment roadmap.'
    : 'Early-stage digital transformation awareness. Assessment-stage readiness with limited current adoption and budget constraints.';

  const summary = `${contact.name} serves as ${contact.title || 'a senior executive'} at ${contact.company}, demonstrating a ${personaType.toLowerCase()} profile. With a ${decisionStyle.toLowerCase()} approach to leadership, they are currently focused on ${initiatives[0].toLowerCase()} and ${initiatives[1].toLowerCase()}. Their organization shows ${techReadinessLevel.toLowerCase()} technology readiness with ${sourcesVerified} verified sources corroborating this assessment.`;

  return {
    persona_type: personaType,
    decision_style: decisionStyle,
    executive_summary: summary,
    tech_readiness_level: techReadinessLevel,
    tech_readiness_explanation: techExplanation,
    pain_points: painPoints,
    initiatives,
    interests,
    sources_verified_count: sourcesVerified,
    confidence_pct: confidencePct,
    confidence_level: confidenceLevel,
  };
}

export const MOCK_SOURCES = [
  { name: 'Company Website', tier: 1, type: 'Company Website' },
  { name: 'LinkedIn Profile', tier: 1, type: 'LinkedIn' },
  { name: 'Official Press Release', tier: 1, type: 'Press Release' },
  { name: 'Philippine Daily Inquirer', tier: 2, type: 'News' },
  { name: 'BusinessWorld', tier: 2, type: 'News' },
  { name: 'Annual Report 2024', tier: 1, type: 'Annual Report' },
  { name: 'SEC Filing', tier: 1, type: 'Government Filing' },
  { name: 'Tech in Asia', tier: 3, type: 'News' },
];

// ═══════════════════════════════════════════════════════════════
// MP3 Part 9: Evidence-Grounded Mock Mode
// ═══════════════════════════════════════════════════════════════

export interface MockEvidenceArtifact {
  evidenceContext: EvidenceContext;
  confidenceAssessment: ConfidenceAssessment;
  citationMap: CitationMap;
  explainabilityReport: ExplainabilityReport;
  persona: SynthesizedPersona;
  builtPrompt: ReturnType<PromptBuilder['build']>;
  mockIntelligence: MockIntelligence;
}

/**
 * Generate a complete evidence-grounded mock artifact that exercises the
 * full MP3 Part 3 reasoning pipeline without requiring live AI APIs.
 *
 * Pipeline: MockEvidencePackage → EvidenceContextBuilder → ConfidencePropagator
 *           → Synthesizer.synthesizeFromContext → CitationMapper → ExplainabilityLayer
 */
export function generateMockEvidenceArtifact(
  contact: Pick<Contact, 'id' | 'name' | 'title' | 'company'>,
): MockEvidenceArtifact {
  const rand = seedRandom(contact.id);

  // 1. Build a mock EvidencePackage with verified facts
  const evidence = buildMockEvidencePackage(contact, rand);

  // 2. Build EvidenceContext from the EvidencePackage
  const contextBuilder = new EvidenceContextBuilder();
  const evidenceContext = contextBuilder.build(evidence);

  // 3. Propagate confidence from evidence to the artifact
  const confidencePropagator = new ConfidencePropagator();
  const confidenceAssessment = confidencePropagator.assessContext(evidenceContext);

  // 4. Build AI prompt from the EvidenceContext (simulating what a real provider would receive)
  const promptBuilder = new PromptBuilder();
  const builtPrompt = promptBuilder.build(evidenceContext, 'persona_generation');

  // 5. Synthesize persona from the EvidenceContext (deterministic)
  const synthesizer = new SynthesizerAgent({} as never);
  const persona = synthesizer.synthesizeFromContext(evidenceContext, confidenceAssessment);

  // 6. Build citation map from the evidence context
  const citationMapper = new CitationMapper();
  const citationMap = citationMapper.mapFromContext(evidenceContext, confidenceAssessment);

  // 7. Generate explainability report from citations
  const explainabilityLayer = new ExplainabilityLayer();
  const explainabilityReport = explainabilityLayer.explainFromCitations(
    evidenceContext,
    confidenceAssessment,
    citationMap,
  );

  // 8. Also generate the legacy MockIntelligence for backward compatibility
  const mockIntelligence = generateMockIntelligence(contact);

  return {
    evidenceContext,
    confidenceAssessment,
    citationMap,
    explainabilityReport,
    persona,
    builtPrompt,
    mockIntelligence,
  };
}

function buildMockEvidencePackage(
  contact: Pick<Contact, 'id' | 'name' | 'title' | 'company'>,
  rand: () => number,
): EvidencePackage {
  const painPoints = pick(PAIN_POINTS, rand, 2);
  const initiatives = pick(INITIATIVES, rand, 2);
  const interests = pick(INTERESTS, rand, 3);
  const now = new Date().toISOString();

  const sourceTypeMap: Record<string, EvidenceSource['sourceType']> = {
    'Company Website': 'company_website',
    'LinkedIn Profile': 'linkedin',
    'Official Press Release': 'press_release',
    'Philippine Daily Inquirer': 'news_article',
    'BusinessWorld': 'news_article',
    'Annual Report 2024': 'industry_report',
    'SEC Filing': 'other',
    'Tech in Asia': 'blog_post',
  };

  // Build mock sources
  const sources: EvidenceSource[] = MOCK_SOURCES.slice(0, 5).map((src, i) => ({
    id: `mock_src_${i + 1}`,
    url: `https://example.com/${src.name.toLowerCase().replace(/\s+/g, '-')}`,
    title: `${src.name} — ${contact.name}`,
    sourceName: src.name,
    sourceTier: src.tier as 1 | 2 | 3,
    authorityScore: src.tier === 1 ? 90 + Math.floor(rand() * 10) : src.tier === 2 ? 70 + Math.floor(rand() * 15) : 50 + Math.floor(rand() * 15),
    sourceType: sourceTypeMap[src.name] || 'other',
    publishedDate: now,
    retrievedAt: now,
    snippet: `Information about ${contact.name} from ${src.name}.`,
  }));

  // Build mock facts using valid FactCategory values
  const facts: Fact[] = [
    createFact({
      factId: 'mock_fact_1',
      subject: contact.name,
      predicate: 'current_position',
      value: contact.title || 'Executive',
      category: 'current_position',
      confidence: 90,
      sourceIds: [sources[0].id, sources[1].id],
      verificationStatus: 'verified',
      metadata: { isFresh: true, explanation: 'Confirmed by company website and LinkedIn profile' },
    }),
    createFact({
      factId: 'mock_fact_2',
      subject: contact.name,
      predicate: 'company',
      value: contact.company,
      category: 'company',
      confidence: 95,
      sourceIds: [sources[0].id, sources[2].id],
      verificationStatus: 'verified',
      metadata: { isFresh: true, explanation: 'Confirmed by company website and press release' },
    }),
    createFact({
      factId: 'mock_fact_3',
      subject: contact.name,
      predicate: 'recent_news',
      value: painPoints[0],
      category: 'recent_news',
      confidence: 75,
      sourceIds: [sources[3].id, sources[4].id],
      verificationStatus: 'corroborated',
      metadata: { isFresh: true, explanation: 'Corroborated by two news sources' },
    }),
    createFact({
      factId: 'mock_fact_4',
      subject: contact.name,
      predicate: 'recent_news',
      value: initiatives[0],
      category: 'recent_news',
      confidence: 80,
      sourceIds: [sources[2].id],
      verificationStatus: 'single_source',
      metadata: { isFresh: true, explanation: 'From official press release' },
    }),
    createFact({
      factId: 'mock_fact_5',
      subject: contact.name,
      predicate: 'professional_history',
      value: interests.join(', '),
      category: 'professional_history',
      confidence: 70,
      sourceIds: [sources[1].id, sources[4].id],
      verificationStatus: 'corroborated',
      metadata: { explanation: 'Derived from LinkedIn profile and news coverage' },
    }),
    createFact({
      factId: 'mock_fact_6',
      subject: contact.name,
      predicate: 'company_industry',
      value: rand() > 0.5 ? 'High — Active cloud migration' : 'Medium — Evaluation stage',
      category: 'company_industry',
      confidence: 65,
      sourceIds: [sources[3].id],
      verificationStatus: 'single_source',
      metadata: { explanation: 'Based on industry news coverage' },
    }),
    createFact({
      factId: 'mock_fact_7',
      subject: contact.name,
      predicate: 'leadership_information',
      value: /^(chief|cto|cio|ceo|coo|cfo|president|managing director)/i.test(contact.title || '') ? 'C-level executive' : 'Senior leader',
      category: 'leadership_information',
      confidence: 85,
      sourceIds: [sources[0].id, sources[1].id],
      verificationStatus: 'verified',
      metadata: { isFresh: true, explanation: 'Confirmed by company website and LinkedIn' },
    }),
  ];

  // Build the EvidencePackage using the factory, then populate with mock data
  const pkg = createEvidencePackage({
    id: contact.id,
    name: contact.name,
    title: contact.title || '',
    company: contact.company,
  });

  pkg.sources = sources;
  pkg.facts = facts;
  pkg.verifiedFactsList = facts.filter((f) => f.verificationStatus === 'verified' || f.verificationStatus === 'corroborated');
  pkg.conflictingFacts = [];
  pkg.conflicts = [];
  pkg.trustScore = 72 + Math.floor(rand() * 15);
  pkg.confidenceBreakdown = new Map();
  pkg.verificationResults = {
    status: 'verified',
    totalFacts: facts.length,
    verifiedCount: 4,
    singleSourceCount: 2,
    corroboratedCount: 2,
    conflictingCount: 0,
    rejectedCount: 0,
    unverifiedCount: 1,
  };
  pkg.verificationWarnings = [];
  pkg.sourceAuthoritySummary = {
    averageAuthority: 82,
    tier1Count: 3,
    tier2Count: 2,
    tier3Count: 0,
    authorityByType: {},
  };
  pkg.evidenceSummary = {
    verifiedFactCount: 4,
    assessedSourceCount: 5,
    completenessScore: 65,
    summary: `${facts.length} verified facts from ${sources.length} sources`,
  };
  pkg.missingEvidenceSummary = {
    missingCategories: ['public_interviews' as never],
    insufficientCategories: [],
    totalMissing: 1,
    recommendations: ['Search for publication history and public interviews'],
  };
  pkg.missingInfo = [
    { category: 'public_interviews', reason: 'No interviews found', queriesAttempted: 2 },
  ];
  pkg.isVerified = true;
  pkg.metadata = {
    createdAt: now,
    updatedAt: now,
    agentsRun: ['SearchAgent', 'ReaderAgent', 'FactExtractor', 'VerifierAgent'],
    searchQueryCount: 8,
    documentCount: 5,
    cacheHit: false,
    planId: 'mock_plan',
  };
  pkg.statistics = {
    totalQueriesExecuted: 8,
    totalSourcesFound: 5,
    totalDocumentsRead: 5,
    sourcesByTier: { tier1: 3, tier2: 2, tier3: 0 },
    sourcesByCategory: {},
    averageSnippetLength: 120,
    duplicateSourcesRemoved: 2,
  };

  return pkg;
}
