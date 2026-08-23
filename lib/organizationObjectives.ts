import type { OrganizationObjectives } from '@/services/decision/DecisionTypes';

const DEFAULT_OBJECTIVES: OrganizationObjectives = {
  strategicGoals: [
    'Strengthen executive relationships for long-term partnership',
    'Identify high-fit opportunities for business collaboration',
    'Maximize event ROI through targeted executive engagement',
  ],
  targetIndustries: [
    'Real Estate',
    'Technology',
    'Financial Services',
    'Construction',
    'Hospitality',
  ],
  desiredOpportunities: [
    'speaker',
    'sponsor',
    'VIP guest',
    'panelist',
    'partner',
  ],
  eventGoals: [
    'Build brand awareness among key decision-makers',
    'Generate qualified executive leads',
    'Establish thought leadership in target industries',
  ],
  riskTolerance: 'medium',
};

export function getOrganizationObjectives(): OrganizationObjectives {
  return DEFAULT_OBJECTIVES;
}
