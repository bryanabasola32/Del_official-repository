/*
# Del AI — Seed Data

Seeds 3 sample events and 8 realistic executive contacts for prototype demonstration.
All seed data represents real companies and plausible executive profiles for the Philippines market.
*/

-- Sample Events
INSERT INTO events (id, event_name, theme, date, venue, organizer, description, target_industries, target_audience, primary_theme, status)
VALUES
(
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'AI Leadership Summit 2025',
  'Artificial Intelligence & Digital Transformation',
  '2025-09-15',
  'Manila Hotel, Rizal Ballroom',
  'DELCA VisionTech Inc.',
  'A premier gathering of C-suite and senior technology executives exploring the strategic deployment of AI across banking, finance, and enterprise operations. Sessions cover generative AI implementation, responsible AI governance, AI-driven customer experience, and workforce transformation. Target attendees are CIOs, CTOs, CDOs, and senior IT directors from financial services, retail, manufacturing, and BPO sectors actively investing in AI and cloud infrastructure.',
  ARRAY['Technology', 'Banking & Finance', 'BPO', 'Retail', 'Manufacturing'],
  'C-Suite Technology & Innovation Executives',
  'Artificial Intelligence',
  'upcoming'
),
(
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'Cloud & Cybersecurity Forum 2025',
  'Cloud Infrastructure & Security',
  '2025-10-22',
  'Shangri-La BGC, Grand Ballroom',
  'DELCA VisionTech Inc.',
  'A focused forum for IT leaders and CISOs tackling hybrid cloud migration, zero-trust security architecture, and compliance in regulated industries. Key sessions address multi-cloud cost optimization, ransomware resilience, PSE/BSP compliance frameworks, and secure DevSecOps pipelines. Designed for IT Directors, CISOs, Cloud Architects, and Operations heads from banking, insurance, healthcare, and government sectors undergoing infrastructure modernization.',
  ARRAY['Banking & Finance', 'Insurance', 'Healthcare', 'Government', 'Telecommunications'],
  'IT Leadership, Security & Infrastructure Professionals',
  'Cloud Infrastructure',
  'upcoming'
),
(
  'c3d4e5f6-a7b8-9012-cdef-123456789012',
  'CIO Forum: Future Enterprise 2025',
  'Enterprise Modernization & Digital Strategy',
  '2025-11-18',
  'Conrad Manila, Admiralty Ballroom',
  'DELCA VisionTech Inc.',
  'An exclusive peer forum for chief information officers and senior digital leaders addressing enterprise-wide modernization strategy, ERP transformation, data platform investments, and the evolving CIO mandate. Discussions include build-vs-buy dilemmas for core systems, managing legacy debt, aligning IT investment with board priorities, and scaling digital talent. Attendance is invitation-only and limited to CIOs, CDOs, and VP-level IT executives from top-500 Philippine enterprises.',
  ARRAY['Conglomerates', 'Manufacturing', 'Retail & Consumer Goods', 'Real Estate', 'Logistics'],
  'Chief Information Officers & Senior Digital Leaders',
  'Enterprise Modernization',
  'upcoming'
)
ON CONFLICT DO NOTHING;

-- Sample Contacts (realistic PH executive profiles)
INSERT INTO contacts (id, name, title, company, email, decision_making_role, import_status, persona_status, persona_confidence_level, persona_confidence_pct, last_researched_date)
VALUES
(
  'd4e5f6a7-b8c9-0123-defa-234567890123',
  'Maria Santos',
  'Chief Information Officer',
  'BDO Unibank',
  'msantos@bdo.com.ph',
  'budget-holder',
  'imported',
  'completed',
  'high',
  82,
  now() - interval '34 days'
),
(
  'e5f6a7b8-c9d0-1234-efab-345678901234',
  'John Rafael Cruz',
  'VP for Technology & Innovation',
  'SM Prime Holdings',
  null,
  'influencer',
  'imported',
  'completed',
  'medium',
  58,
  now() - interval '21 days'
),
(
  'f6a7b8c9-d0e1-2345-fabc-456789012345',
  'Angela Reyes Lim',
  'Chief Digital Officer',
  'Ayala Corporation',
  'alim@ayala.com.ph',
  'budget-holder',
  'imported',
  'low_confidence',
  'low',
  28,
  now() - interval '45 days'
),
(
  'a7b8c9d0-e1f2-3456-abcd-567890123456',
  'Roberto Villanueva',
  'Head of IT Infrastructure',
  'Globe Telecom',
  'rvillanueva@globe.com.ph',
  'influencer',
  'imported',
  'completed',
  'high',
  76,
  now() - interval '12 days'
),
(
  'b8c9d0e1-f2a3-4567-bcde-678901234567',
  'Carmela Diaz',
  'CTO',
  'Metrobank',
  'cdiaz@metrobank.com.ph',
  'budget-holder',
  'imported',
  'completed',
  'medium',
  65,
  now() - interval '28 days'
),
(
  'c9d0e1f2-a3b4-5678-cdef-789012345678',
  'Eduardo Tan',
  'Director of Digital Transformation',
  'JG Summit Holdings',
  'etan@jgsummit.com.ph',
  'influencer',
  'imported',
  'completed',
  'high',
  88,
  now() - interval '8 days'
),
(
  'd0e1f2a3-b4c5-6789-defa-890123456789',
  'Patricia Mendoza',
  'CISO',
  'UnionBank of the Philippines',
  'pmendoza@unionbankph.com',
  'budget-holder',
  'imported',
  'completed',
  'medium',
  71,
  now() - interval '19 days'
),
(
  'e1f2a3b4-c5d6-7890-efab-901234567890',
  'Michael Reyes',
  'VP IT Operations',
  'PLDT',
  null,
  'influencer',
  'imported',
  'needs_review',
  null,
  null,
  null
)
ON CONFLICT DO NOTHING;

-- Persona facts for Maria Santos (High confidence)
INSERT INTO persona_facts (contact_id, field_type, value, confidence_level, reasoning_note, timeframe, order_index)
VALUES
('d4e5f6a7-b8c9-0123-defa-234567890123', 'pain_point', 'Rising cloud infrastructure costs and multi-cloud sprawl management', 'verified', 'Confirmed via BDO annual report Q3 2024 and BusinessWorld interview citing cloud cost optimization as top priority.', '2024-2025', 1),
('d4e5f6a7-b8c9-0123-defa-234567890123', 'pain_point', 'Manual compliance reporting for BSP regulatory requirements', 'probable', 'Referenced in Bangko Sentral circulars and industry roundtable coverage. Single Tier 2 source.', '2024', 2),
('d4e5f6a7-b8c9-0123-defa-234567890123', 'pain_point', 'Legacy core banking system modernization while maintaining uptime', 'verified', 'Confirmed in BDO investor relations deck and PhilStar technology interview.', '2023-2025', 3),
('d4e5f6a7-b8c9-0123-defa-234567890123', 'initiative', 'ERP and core banking platform modernization (Phase 2 underway)', 'verified', 'Publicly disclosed in Q3 2024 earnings call and confirmed by BDO newsroom press release.', 'Q3 2024 - Q2 2026', 1),
('d4e5f6a7-b8c9-0123-defa-234567890123', 'initiative', 'AI-powered fraud detection system deployment across all branches', 'probable', 'Mentioned in Inquirer Business article and BDO corporate social responsibility report.', '2025', 2),
('d4e5f6a7-b8c9-0123-defa-234567890123', 'tech_readiness', 'Medium-High — Active cloud migration with ERP modernization in progress. Confirmed Azure partnership but hybrid model still being validated.', 'verified', 'Azure partnership announced in official press release. ERP rollout confirmed in earnings call. Cloud maturity assessment referenced in BSP report.', null, 1),
('d4e5f6a7-b8c9-0123-defa-234567890123', 'professional_interest', 'Responsible AI governance, cloud cost optimization, BSP digital banking compliance, fintech partnerships', 'verified', 'Consistent themes across multiple Tier 1 and Tier 2 sources over 12 months.', null, 1),
('d4e5f6a7-b8c9-0123-defa-234567890123', 'decision_making_role', 'Budget-holder — Final decision authority on technology investments above PHP 50M per BDO governance structure.', 'verified', 'Confirmed via BDO organizational chart in annual report and LinkedIn role description.', null, 1)
ON CONFLICT DO NOTHING;

-- Persona facts for Eduardo Tan (High confidence)
INSERT INTO persona_facts (contact_id, field_type, value, confidence_level, reasoning_note, timeframe, order_index)
VALUES
('c9d0e1f2-a3b4-5678-cdef-789012345678', 'pain_point', 'Unifying digital transformation strategy across 10+ business units in a conglomerate structure', 'verified', 'Disclosed in JG Summit Holdings annual report and CDO interview with BusinessWorld.', '2024-2025', 1),
('c9d0e1f2-a3b4-5678-cdef-789012345678', 'pain_point', 'Data silos between Cebu Pacific, Robinsons, and JG Summit Petrochemicals', 'probable', 'Referenced in industry analyst report on Philippine conglomerates and JG Summit digital strategy coverage.', '2024', 2),
('c9d0e1f2-a3b4-5678-cdef-789012345678', 'initiative', 'Group-wide data platform and analytics hub (Project Horizon) targeting 2025 full rollout', 'verified', 'Announced in JG Summit Holdings Q2 2024 investor briefing and confirmed in PSE disclosure.', 'Q4 2024 - Q4 2025', 1),
('c9d0e1f2-a3b4-5678-cdef-789012345678', 'tech_readiness', 'High — Data platform rollout underway with multiple SaaS and cloud vendors contracted. Active AI evaluation for group-level use cases.', 'verified', 'PSE disclosure and investor briefing confirm active major cloud and data vendor contracts.', null, 1)
ON CONFLICT DO NOTHING;

-- Event scores (pre-seeded for demo)
INSERT INTO event_scores (contact_id, event_id, role_score, industry_score, painpoint_score, techreadiness_score, total_score, confidence_capped, reasoning)
VALUES
-- Maria Santos vs AI Leadership Summit
('d4e5f6a7-b8c9-0123-defa-234567890123', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 38, 23, 24, 9, 95, false, 'CIO role directly maps to event theme. Banking industry is a primary target. Pain points around AI fraud detection and cloud costs align precisely with summit sessions. Medium-High tech readiness confirms implementation-stage interest.'),
-- Maria Santos vs Cloud & Cybersecurity Forum
('d4e5f6a7-b8c9-0123-defa-234567890123', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 35, 22, 22, 9, 88, false, 'CIO with active cloud migration program is a strong fit. BSP compliance pain point aligns with regulated-industry security sessions. Cloud infrastructure cost focus directly relevant.'),
-- Maria Santos vs CIO Forum
('d4e5f6a7-b8c9-0123-defa-234567890123', 'c3d4e5f6-a7b8-9012-cdef-123456789012', 36, 20, 21, 8, 85, false, 'CIO role is the target persona. ERP modernization initiative maps perfectly to forum agenda. Banking not primary industry but financial services frequently crosslisted.'),
-- John Cruz vs AI Leadership Summit
('e5f6a7b8-c9d0-1234-efab-345678901234', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 30, 19, 18, 7, 74, false, 'VP Technology at major retail conglomerate. Retail is a listed target industry. Influence but not full budget authority — moderately weighted score.'),
-- Angela Lim vs AI Leadership Summit
('f6a7b8c9-d0e1-2345-fabc-456789012345', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 36, 22, 15, 6, 79, true, 'CDO title strong match. However persona confidence is Low (28%) — score capped and flagged as tentative. Conglomerate industry relevant. Pain point data insufficient for strong alignment.'),
-- Eduardo Tan vs AI Leadership Summit
('c9d0e1f2-a3b4-5678-cdef-789012345678', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 34, 20, 23, 10, 87, false, 'Director of Digital Transformation with active AI evaluation program. Conglomerate covering multiple industries. High tech readiness + data platform initiative = strong session alignment.'),
-- Roberto Villanueva vs Cloud Forum
('a7b8c9d0-e1f2-3456-abcd-567890123456', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 36, 24, 22, 9, 91, false, 'Head of IT Infrastructure at major telco — direct match for cloud forum. Telecommunications is a listed target industry. Infrastructure focus perfectly aligned with multi-cloud and zero-trust sessions.'),
-- Carmela Diaz vs Cloud Forum
('b8c9d0e1-f2a3-4567-bcde-678901234567', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 37, 23, 21, 8, 89, false, 'CTO at major bank. Banking is primary target. Compliance and cybersecurity are recurring themes in Metrobank technology strategy.'),
-- Patricia Mendoza vs Cloud Forum
('d0e1f2a3-b4c5-6789-defa-890123456789', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 39, 23, 24, 9, 95, false, 'CISO role is the single best-fit title for the Cloud & Cybersecurity Forum. Banking sector primary target. Security and compliance pain points identical to forum agenda.')
ON CONFLICT DO NOTHING;

-- Mark some as final attendees
UPDATE event_scores SET is_final_attendee = true
WHERE (contact_id = 'd4e5f6a7-b8c9-0123-defa-234567890123' AND event_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
   OR (contact_id = 'c9d0e1f2-a3b4-5678-cdef-789012345678' AND event_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');

-- Activity log seed
INSERT INTO activity_log (action_type, related_contact_id, related_event_id, status, description, timestamp)
VALUES
('import', null, null, 'success', 'Imported 8 executives from roster spreadsheet', now() - interval '5 days'),
('generate_intelligence', 'd4e5f6a7-b8c9-0123-defa-234567890123', null, 'success', 'Generated Executive Intelligence for Maria Santos (BDO Unibank)', now() - interval '34 days'),
('generate_intelligence', 'c9d0e1f2-a3b4-5678-cdef-789012345678', null, 'success', 'Generated Executive Intelligence for Eduardo Tan (JG Summit Holdings)', now() - interval '8 days'),
('score', 'd4e5f6a7-b8c9-0123-defa-234567890123', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'success', 'Scored Maria Santos vs AI Leadership Summit 2025: 95%', now() - interval '3 days'),
('score', 'c9d0e1f2-a3b4-5678-cdef-789012345678', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'success', 'Scored Eduardo Tan vs AI Leadership Summit 2025: 87%', now() - interval '3 days'),
('create_event', null, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'success', 'Created event: AI Leadership Summit 2025', now() - interval '10 days'),
('create_event', null, 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 'success', 'Created event: Cloud & Cybersecurity Forum 2025', now() - interval '10 days'),
('create_event', null, 'c3d4e5f6-a7b8-9012-cdef-123456789012', 'success', 'Created event: CIO Forum: Future Enterprise 2025', now() - interval '10 days')
ON CONFLICT DO NOTHING;
