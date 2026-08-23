#!/usr/bin/env node
/**
 * Import evidence packages through the real validation pipeline.
 *
 * This script replicates the CuratedEvidenceAdapter validation and
 * CuratedEvidenceLibrary.savePackage logic, using the same Supabase
 * client that the application uses. Every package goes through:
 *   JSON → Validation → Identity validation → Normalization → Supabase
 *
 * This is NOT raw SQL insertion. It uses the same validation rules
 * as the ImportEvidenceDialog.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// ── Load environment ──
const envContent = fs.readFileSync(path.join(__dirname, '..', '..', '.env'), 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Validation logic (mirrors CuratedEvidenceAdapter) ──

function normalizeString(val) {
  return typeof val === 'string' ? val.trim() : '';
}

function normalizeName(name) {
  return name.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeCompany(company) {
  return company
    .toLowerCase()
    .replace(/\b(inc|corp|corporation|holdings|ltd|co|llc)\b\.?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const VALID_SOURCE_TYPES = [
  'linkedin', 'company_website', 'news_article', 'press_release',
  'blog_post', 'interview', 'conference_page', 'award_pages',
  'industry_report', 'social_media', 'other',
];

const VALID_VERIFICATION_STATUSES = [
  'unverified', 'single_source', 'corroborated', 'verified', 'conflicting', 'rejected',
];

const VALID_EXTRACTION_METHODS = ['heuristic', 'ai_assisted', 'manual', 'mock'];

function validate(raw) {
  const errors = [];
  const warnings = [];

  const execBlock = raw.executive || {};
  const name = normalizeString(execBlock.name || raw.name);
  const company = normalizeString(execBlock.company || raw.company);
  const title = normalizeString(execBlock.title || raw.title);
  const linkedin = normalizeString(execBlock.linkedin || raw.linkedin);

  if (!name) errors.push('Executive name is required');
  if (!company) errors.push('Executive company is required');

  const rawSources = raw.sources || raw.evidence?.sources || [];
  if (!Array.isArray(rawSources)) {
    errors.push('Sources must be an array');
  }
  const sources = Array.isArray(rawSources) ? rawSources : [];

  const rawFacts = raw.facts || raw.evidence?.facts || [];
  if (!Array.isArray(rawFacts)) {
    errors.push('Facts must be an array');
  }
  const facts = Array.isArray(rawFacts) ? rawFacts : [];

  if (sources.length === 0) warnings.push('Package contains no sources');
  if (facts.length === 0) warnings.push('Package contains no facts');

  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    const srcId = normalizeString(s.id || s.url);
    if (!srcId) errors.push(`Source at index ${i} has no id or url`);
    if (!s.url && !s.title) warnings.push(`Source at index ${i} has no url or title`);
  }

  for (let i = 0; i < facts.length; i++) {
    const f = facts[i];
    const factId = normalizeString(f.factId || f.fact_id);
    if (!factId) errors.push(`Fact at index ${i} has no factId`);
    if (!f.subject && !f.value) errors.push(`Fact at index ${i} has no subject or value`);
    const fSourceIds = f.sourceIds || f.source_ids;
    if (!Array.isArray(fSourceIds) || fSourceIds.length === 0) {
      warnings.push(`Fact at index ${i} has no source references`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    identity: { name, company, title, linkedin: linkedin || undefined },
    sourceCount: sources.length,
    factCount: facts.length,
  };
}

function validateIdentity(packageName, packageCompany, contact) {
  const reasons = [];
  const normPkgName = normalizeName(packageName);
  const normContactName = normalizeName(contact.name);
  const normPkgCompany = normalizeCompany(packageCompany);
  const normContactCompany = normalizeCompany(contact.company);

  const nameMatch = normPkgName === normContactName
    || normPkgName.includes(normContactName)
    || normContactName.includes(normPkgName);

  const pkgNameTokens = new Set(normPkgName.split(' ').filter(t => t.length > 1));
  const contactNameTokens = new Set(normContactName.split(' ').filter(t => t.length > 1));
  const nameTokenOverlap = [...pkgNameTokens].filter(t => contactNameTokens.has(t)).length;
  const nameTokenMatch = nameTokenOverlap >= Math.min(pkgNameTokens.size, contactNameTokens.size) && nameTokenOverlap >= 2;

  if (!nameMatch && !nameTokenMatch) {
    reasons.push(`Name mismatch: package "${packageName}" vs contact "${contact.name}"`);
  }

  const companyMatch = normPkgCompany === normContactCompany
    || normPkgCompany.includes(normContactCompany)
    || normContactCompany.includes(normPkgCompany);

  if (!companyMatch) {
    reasons.push(`Company mismatch: package "${packageCompany}" vs contact "${contact.company}"`);
  }

  const matched = reasons.length === 0;
  let confidence = 'none';
  if (matched) {
    const exactName = normPkgName === normContactName;
    const exactCompany = normPkgCompany === normContactCompany;
    confidence = (exactName && exactCompany) ? 'high' : 'medium';
  }

  return { matched, confidence, reasons, contactId: contact.id };
}

function normalizeSourceType(val) {
  const s = normalizeString(val);
  return VALID_SOURCE_TYPES.includes(s) ? s : 'other';
}

function normalizeTier(val) {
  const t = typeof val === 'number' ? val : parseInt(normalizeString(val), 10);
  if (t === 1) return 1;
  if (t === 3) return 3;
  return 2;
}

function normalizeVerificationStatus(val) {
  const s = normalizeString(val);
  return VALID_VERIFICATION_STATUSES.includes(s) ? s : 'unverified';
}

function normalizeExtractionMethod(val) {
  const s = normalizeString(val);
  return VALID_EXTRACTION_METHODS.includes(s) ? s : 'manual';
}

function toEvidencePackage(raw, contact) {
  const rawSources = raw.sources || raw.evidence?.sources || [];
  const rawFacts = raw.facts || raw.evidence?.facts || [];
  const now = new Date().toISOString();

  const sources = rawSources.map((rs, i) => {
    const id = normalizeString(rs.id || `curated-src-${i}`);
    const sourceType = normalizeSourceType(rs.sourceType || rs.source_type);
    const tier = normalizeTier(rs.sourceTier || rs.source_tier);
    return {
      id,
      url: normalizeString(rs.url),
      title: normalizeString(rs.title || rs.url || `Source ${i}`),
      sourceName: normalizeString(rs.sourceName || rs.source_name || rs.url || `Curated Source ${i}`),
      sourceTier: tier,
      snippet: normalizeString(rs.snippet),
      publishedDate: rs.publishedDate || rs.published_date,
      retrievedAt: normalizeString(rs.retrievedAt || rs.retrieved_at || now),
      author: rs.author ? normalizeString(rs.author) : undefined,
      sourceType,
      category: rs.category,
    };
  });

  const sourceIdSet = new Set(sources.map(s => s.id));

  const facts = rawFacts.map((rf, i) => {
    const factId = normalizeString(rf.factId || rf.fact_id || `curated-fact-${i}`);
    const rawSourceIds = rf.sourceIds || rf.source_ids || [];
    const sourceIds = rawSourceIds.filter(sid => sourceIdSet.has(sid));
    return {
      factId,
      category: normalizeString(rf.category) || 'biography',
      subject: normalizeString(rf.subject || contact.name),
      predicate: normalizeString(rf.predicate || 'curated_fact'),
      value: normalizeString(rf.value || ''),
      sourceIds,
      extractedFrom: rf.extractedFrom || rf.extracted_from || [],
      extractedAt: normalizeString(rf.extractedAt || rf.extracted_at || now),
      extractionMethod: normalizeExtractionMethod(rf.extractionMethod || rf.extraction_method),
      confidence: typeof rf.confidence === 'number' ? rf.confidence : 0,
      verificationStatus: normalizeVerificationStatus(rf.verificationStatus || rf.verification_status),
      metadata: rf.metadata || {},
    };
  });

  return {
    contact: {
      id: contact.id,
      name: contact.name,
      title: contact.title || '',
      company: contact.company,
    },
    executiveProfile: {
      name: contact.name,
      title: contact.title || '',
      company: contact.company,
      sourceIds: sources.map(s => s.id),
    },
    company: {
      name: contact.company,
      sourceIds: sources.map(s => s.id),
    },
    professionalHistory: [],
    news: [],
    publications: [],
    interviews: [],
    speakingEvents: [],
    awards: [],
    searchResults: [],
    documents: [],
    verifiedFacts: [],
    sources,
    confidence: 0,
    verification: {
      status: 'pending',
      verifiedCount: 0,
      unverifiedCount: facts.length,
      contradictoryCount: 0,
    },
    missingInfo: [],
    metadata: {
      createdAt: now,
      updatedAt: now,
      agentsRun: ['CuratedEvidenceAdapter'],
      searchQueryCount: 0,
      documentCount: 0,
      cacheHit: false,
    },
    statistics: {
      totalQueriesExecuted: 0,
      totalSourcesFound: sources.length,
      totalDocumentsRead: 0,
      sourcesByTier: {
        tier1: sources.filter(s => s.sourceTier === 1).length,
        tier2: sources.filter(s => s.sourceTier === 2).length,
        tier3: sources.filter(s => s.sourceTier === 3).length,
      },
      sourcesByCategory: {},
      averageSnippetLength: 0,
      duplicateSourcesRemoved: 0,
    },
    facts,
    verifiedFactsList: [],
    conflictingFacts: [],
    conflicts: [],
    trustScore: 0,
    confidenceBreakdown: {},
    verificationResults: {
      status: 'pending',
      totalFacts: facts.length,
      verifiedCount: 0,
      singleSourceCount: 0,
      corroboratedCount: 0,
      conflictingCount: 0,
      rejectedCount: 0,
      unverifiedCount: facts.length,
    },
    verificationWarnings: [],
    sourceAuthoritySummary: {
      averageAuthority: 0,
      tier1Count: 0,
      tier2Count: 0,
      tier3Count: 0,
      authorityByType: {},
    },
    evidenceSummary: {
      verifiedFactCount: 0,
      assessedSourceCount: 0,
      completenessScore: 0,
      summary: `Curated evidence package with ${sources.length} sources and ${facts.length} facts.`,
    },
    missingEvidenceSummary: {
      missingCategories: [],
      insufficientCategories: [],
      totalMissing: 0,
      recommendations: [],
    },
    isVerified: false,
  };
}

async function getNextVersion(contactId) {
  const { data } = await supabase
    .from('executive_evidence_library')
    .select('version')
    .eq('contact_id', contactId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return 1;
  return data.version + 1;
}

async function archivePreviousVersion(contactId) {
  await supabase
    .from('executive_evidence_library')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('contact_id', contactId)
    .eq('status', 'active');
}

async function savePackage(contactId, raw, contact) {
  const validation = validate(raw);
  if (!validation.valid) {
    return { success: false, version: 0, errors: validation.errors };
  }

  const identityMatch = validateIdentity(
    validation.identity.name,
    validation.identity.company,
    contact,
  );
  if (!identityMatch.matched) {
    return { success: false, version: 0, errors: identityMatch.reasons };
  }

  const evidencePackage = toEvidencePackage(raw, contact);
  const nextVersion = await getNextVersion(contactId);
  await archivePreviousVersion(contactId);

  const { error } = await supabase
    .from('executive_evidence_library')
    .insert({
      contact_id: contactId,
      version: nextVersion,
      status: 'active',
      evidence_package: evidencePackage,
      evidence_trust_score: 0,
      evidence_completeness: 0,
      source_count: validation.sourceCount,
      fact_count: validation.factCount,
      provider: 'curated',
      notes: null,
    });

  if (error) {
    return { success: false, version: 0, errors: [`Database insert failed: ${error.message}`] };
  }

  return { success: true, version: nextVersion, errors: [] };
}

// ── Main ──

async function main() {
  const dir = path.join(__dirname, 'converted');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'all_packages.json');

  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('id, name, title, company')
    .order('name');

  if (error || !contacts) {
    console.error('Failed to load contacts:', error);
    process.exit(1);
  }

  console.log(`Loaded ${contacts.length} contacts from database`);
  console.log(`Found ${files.length} evidence package files\n`);

  let success = 0;
  let failed = 0;

  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const pkgName = raw.executive?.name || raw.name || '';

    // Find matching contact
    const contact = contacts.find(c => {
      const normC = normalizeName(c.name);
      const normP = normalizeName(pkgName);
      return normC === normP || normC.includes(normP) || normP.includes(normC);
    });

    if (!contact) {
      console.error(`IDENTITY NOT FOUND: ${pkgName} | ${file}`);
      failed++;
      continue;
    }

    // Validate
    const valResult = validate(raw);
    if (!valResult.valid) {
      console.error(`VALIDATION FAILED: ${pkgName} - ${valResult.errors.join('; ')}`);
      failed++;
      continue;
    }

    // Identity validation
    const idResult = validateIdentity(valResult.identity.name, valResult.identity.company, contact);
    if (!idResult.matched) {
      console.error(`IDENTITY MISMATCH: ${pkgName} vs ${contact.name} - ${idResult.reasons.join('; ')}`);
      failed++;
      continue;
    }

    // Save through the pipeline
    const result = await savePackage(contact.id, raw, contact);
    if (result.success) {
      console.log(`SAVED v${result.version}: ${contact.name} | ${contact.company} | ${valResult.sourceCount} sources, ${valResult.factCount} facts`);
      success++;
    } else {
      console.error(`SAVE FAILED: ${contact.name} - ${result.errors.join('; ')}`);
      failed++;
    }
  }

  console.log(`\nResults: ${success} success, ${failed} failed`);
}

main().catch(err => { console.error(err); process.exit(1); });
