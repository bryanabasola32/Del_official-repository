#!/usr/bin/env python3
"""
Convert Executive Intelligence Object JSON files into RawCuratedPackage
format compatible with DEL's existing ImportEvidenceDialog and
CuratedEvidenceAdapter validation pipeline.

Input schema (Executive Intelligence Object):
  - identity.full_name.value, identity.current_position.value, identity.current_company.value
  - source_registry: { "1": { domain, title, type, trust_tier, date } }
  - career_history, awards, leadership_style, strategic_priorities,
    technology_interests, decision_profile, etc. (each with confidence + sources)

Output schema (RawCuratedPackage):
  - executive: { name, title, company }
  - sources: [ { id, url, title, sourceName, sourceTier, sourceType, ... } ]
  - facts: [ { factId, category, subject, predicate, value, sourceIds, confidence, ... } ]
"""

import json
import os
import re
import sys

TRUST_TIER_MAP = {
    "high": 1,
    "medium": 2,
    "low": 3,
}

SOURCE_TYPE_MAP = {
    "press_release": "press_release",
    "third_party_news": "news_article",
    "official_company_source": "company_website",
    "third_party_financial_data": "industry_report",
    "industry_report": "industry_report",
    "blog_post": "blog_post",
    "interview": "interview",
    "conference_page": "conference_page",
    "award_pages": "award_pages",
    "social_media": "social_media",
    "other": "other",
}


def make_source_id(ref):
    """Convert a source_registry key (int or str) into a source ID."""
    return f"src-{ref}"


def make_fact_id(category, idx):
    return f"fact-{category}-{idx}"


def extract_sources(source_registry):
    """Convert source_registry dict into RawCuratedSource list."""
    sources = []
    for key, src in source_registry.items():
        domain = src.get("domain", "")
        title = src.get("title", domain)
        trust_tier = TRUST_TIER_MAP.get(src.get("trust_tier", "medium"), 2)
        source_type = SOURCE_TYPE_MAP.get(src.get("type", "other"), "other")
        url = f"https://{domain}" if domain else ""

        sources.append({
            "id": make_source_id(key),
            "url": url,
            "title": title,
            "sourceName": domain,
            "sourceTier": trust_tier,
            "sourceType": source_type,
            "snippet": "",
            "publishedDate": src.get("date"),
            "retrievedAt": "2026-08-08T00:00:00.000Z",
            "author": None,
        })
    return sources


def resolve_source_refs(refs):
    """Convert source references (ints or list of ints) to source ID strings."""
    if refs is None:
        return []
    if isinstance(refs, (int, str)):
        refs = [refs]
    return [make_source_id(r) for r in refs]


def extract_facts(exec_entry, exec_name):
    """
    Extract facts from all structured sections of the Executive Intelligence
    Object. Each fact gets a category, predicate, value, sourceIds, and
    confidence.
    """
    facts = []
    idx = 0

    # Identity facts
    identity = exec_entry.get("identity", {})
    for field, label in [("full_name", "name"), ("current_position", "title"), ("current_company", "company")]:
        entry = identity.get(field)
        if isinstance(entry, dict) and entry.get("value"):
            facts.append({
                "factId": make_fact_id("identity", idx),
                "category": "biography",
                "subject": exec_name,
                "predicate": label,
                "value": entry["value"],
                "sourceIds": resolve_source_refs(entry.get("sources")),
                "confidence": entry.get("confidence", 0.8),
                "verificationStatus": "corroborated" if len(entry.get("sources", [])) > 1 else "single_source",
                "extractionMethod": "manual",
                "metadata": {"section": "identity", "field": field},
            })
            idx += 1

    # Education
    edu = identity.get("education", [])
    if isinstance(edu, list):
        for e in edu:
            degree = e.get("degree", "")
            inst = e.get("institution", "")
            val = f"{degree}, {inst}" if degree and inst else degree or inst
            if val:
                facts.append({
                    "factId": make_fact_id("education", idx),
                    "category": "biography",
                    "subject": exec_name,
                    "predicate": "education",
                    "value": val,
                    "sourceIds": resolve_source_refs(e.get("sources")),
                    "confidence": e.get("confidence", 0.8),
                    "verificationStatus": "single_source" if len(e.get("sources", [])) <= 1 else "corroborated",
                    "extractionMethod": "manual",
                    "metadata": {"section": "identity", "field": "education"},
                })
                idx += 1

    # Career history
    career = exec_entry.get("career_history", [])
    if isinstance(career, list):
        for c in career:
            role = c.get("role", "")
            org = c.get("org", "")
            val = f"{role} at {org}" if role and org else role or org
            if val:
                facts.append({
                    "factId": make_fact_id("career", idx),
                    "category": "professional_history",
                    "subject": exec_name,
                    "predicate": "career_history",
                    "value": val,
                    "sourceIds": resolve_source_refs(c.get("sources")),
                    "confidence": c.get("confidence", 0.7),
                    "verificationStatus": "single_source" if len(c.get("sources", [])) <= 1 else "corroborated",
                    "extractionMethod": "manual",
                    "metadata": {"section": "career_history"},
                })
                idx += 1

    # Awards
    awards = exec_entry.get("awards", [])
    if isinstance(awards, list):
        for a in awards:
            award = a.get("award", "")
            org = a.get("org", "")
            year = a.get("year", "")
            parts = [award, org]
            if year:
                parts.append(str(year))
            val = " — ".join(p for p in parts if p)
            if val:
                facts.append({
                    "factId": make_fact_id("awards", idx),
                    "category": "awards",
                    "subject": exec_name,
                    "predicate": "award",
                    "value": val,
                    "sourceIds": resolve_source_refs(a.get("sources")),
                    "confidence": a.get("confidence", 0.9),
                    "verificationStatus": "corroborated" if len(a.get("sources", [])) > 1 else "single_source",
                    "extractionMethod": "manual",
                    "metadata": {"section": "awards"},
                })
                idx += 1

    # Strategic priorities
    priorities = exec_entry.get("strategic_priorities", [])
    if isinstance(priorities, list):
        for p in priorities:
            priority = p.get("priority", "")
            detail = p.get("detail", "")
            val = f"{priority}: {detail}" if detail else priority
            if val:
                facts.append({
                    "factId": make_fact_id("strategy", idx),
                    "category": "strategic_priorities",
                    "subject": exec_name,
                    "predicate": "strategic_priority",
                    "value": val,
                    "sourceIds": resolve_source_refs(p.get("sources")),
                    "confidence": p.get("confidence", 0.8),
                    "verificationStatus": "single_source" if len(p.get("sources", [])) <= 1 else "corroborated",
                    "extractionMethod": "manual",
                    "metadata": {"section": "strategic_priorities"},
                })
                idx += 1

    # Technology interests
    tech = exec_entry.get("technology_interests", [])
    if isinstance(tech, list):
        for t in tech:
            topic = t.get("topic", "")
            if topic:
                facts.append({
                    "factId": make_fact_id("tech", idx),
                    "category": "technology_interests",
                    "subject": exec_name,
                    "predicate": "technology_interest",
                    "value": topic,
                    "sourceIds": resolve_source_refs(t.get("sources")),
                    "confidence": t.get("confidence", 0.7),
                    "verificationStatus": "single_source" if len(t.get("sources", [])) <= 1 else "corroborated",
                    "extractionMethod": "manual",
                    "metadata": {"section": "technology_interests", "evidence_strength": t.get("evidence_strength", "")},
                })
                idx += 1

    # Leadership style (dict of bools with confidence + sources)
    leadership = exec_entry.get("leadership_style", {})
    if isinstance(leadership, dict):
        for trait, val in leadership.items():
            if isinstance(val, dict) and val.get("value"):
                label = trait.replace("_", " ").title()
                facts.append({
                    "factId": make_fact_id("leadership", idx),
                    "category": "leadership_style",
                    "subject": exec_name,
                    "predicate": "leadership_trait",
                    "value": label,
                    "sourceIds": resolve_source_refs(val.get("sources")),
                    "confidence": val.get("confidence", 0.8),
                    "verificationStatus": "single_source" if len(val.get("sources", [])) <= 1 else "corroborated",
                    "extractionMethod": "manual",
                    "metadata": {"section": "leadership_style", "trait": trait},
                })
                idx += 1

    # Decision profile (dict with value/confidence/sources)
    decision = exec_entry.get("decision_profile", {})
    if isinstance(decision, dict):
        for dim, val in decision.items():
            if isinstance(val, dict) and val.get("value"):
                label = dim.replace("_", " ").title()
                facts.append({
                    "factId": make_fact_id("decision", idx),
                    "category": "decision_profile",
                    "subject": exec_name,
                    "predicate": "decision_dimension",
                    "value": f"{label}: {val['value']}",
                    "sourceIds": resolve_source_refs(val.get("sources")),
                    "confidence": val.get("confidence", 0.7),
                    "verificationStatus": "single_source" if len(val.get("sources", [])) <= 1 else "corroborated",
                    "extractionMethod": "manual",
                    "metadata": {"section": "decision_profile", "dimension": dim},
                })
                idx += 1

    # Event signals (dict with value/confidence/sources — only if not "unknown")
    signals = exec_entry.get("event_signals", {})
    if isinstance(signals, dict):
        for signal, val in signals.items():
            if isinstance(val, dict) and val.get("value") and val["value"] != "unknown":
                label = signal.replace("interested_in_", "").replace("_", " ").title()
                facts.append({
                    "factId": make_fact_id("signals", idx),
                    "category": "event_signals",
                    "subject": exec_name,
                    "predicate": "event_interest",
                    "value": f"Interested in {label}",
                    "sourceIds": resolve_source_refs(val.get("sources")),
                    "confidence": val.get("confidence", 0.6),
                    "verificationStatus": "single_source" if len(val.get("sources", [])) <= 1 else "corroborated",
                    "extractionMethod": "manual",
                    "metadata": {"section": "event_signals", "signal": signal},
                })
                idx += 1

    # Board memberships / relationships
    relationships = exec_entry.get("relationships", {})
    if isinstance(relationships, dict):
        boards = relationships.get("board_memberships", [])
        if isinstance(boards, list):
            for b in boards:
                if isinstance(b, str) and b:
                    facts.append({
                        "factId": make_fact_id("boards", idx),
                        "category": "professional_history",
                        "subject": exec_name,
                        "predicate": "board_membership",
                        "value": b,
                        "sourceIds": [],
                        "confidence": 0.7,
                        "verificationStatus": "unverified",
                        "extractionMethod": "manual",
                        "metadata": {"section": "relationships"},
                    })
                    idx += 1
        orgs = relationships.get("industry_organizations", [])
        if isinstance(orgs, list):
            for o in orgs:
                if isinstance(o, str) and o:
                    facts.append({
                        "factId": make_fact_id("orgs", idx),
                        "category": "professional_history",
                        "subject": exec_name,
                        "predicate": "industry_organization",
                        "value": o,
                        "sourceIds": [],
                        "confidence": 0.7,
                        "verificationStatus": "unverified",
                        "extractionMethod": "manual",
                        "metadata": {"section": "relationships"},
                    })
                    idx += 1

    # Executive keywords
    keywords = exec_entry.get("executive_keywords", [])
    if isinstance(keywords, list):
        for kw in keywords:
            if isinstance(kw, str) and kw:
                facts.append({
                    "factId": make_fact_id("keywords", idx),
                    "category": "executive_keywords",
                    "subject": exec_name,
                    "predicate": "keyword",
                    "value": kw,
                    "sourceIds": [],
                    "confidence": 0.6,
                    "verificationStatus": "unverified",
                    "extractionMethod": "manual",
                    "metadata": {"section": "executive_keywords"},
                })
                idx += 1

    # Communication style
    comm = exec_entry.get("communication_style", {})
    if isinstance(comm, dict):
        register = comm.get("register")
        if register and isinstance(register, str):
            facts.append({
                "factId": make_fact_id("comm", idx),
                "category": "communication_style",
                "subject": exec_name,
                "predicate": "communication_register",
                "value": register,
                "sourceIds": [],
                "confidence": 0.7,
                "verificationStatus": "unverified",
                "extractionMethod": "manual",
                "metadata": {"section": "communication_style"},
            })
            idx += 1
        traits = comm.get("traits")
        if isinstance(traits, list):
            for trait in traits:
                if isinstance(trait, str) and trait:
                    facts.append({
                        "factId": make_fact_id("comm", idx),
                        "category": "communication_style",
                        "subject": exec_name,
                        "predicate": "communication_trait",
                        "value": trait,
                        "sourceIds": [],
                        "confidence": 0.7,
                        "verificationStatus": "unverified",
                        "extractionMethod": "manual",
                        "metadata": {"section": "communication_style"},
                    })
                    idx += 1

    return facts


def clean_company_name(company):
    """Strip parenthetical aliases for matching but keep full name."""
    return company


def convert_executive(exec_entry):
    """Convert a single Executive Intelligence Object to RawCuratedPackage."""
    identity = exec_entry.get("identity", {})

    name = ""
    if isinstance(identity.get("full_name"), dict):
        name = identity["full_name"].get("value", "")
    title = ""
    if isinstance(identity.get("current_position"), dict):
        title = identity["current_position"].get("value", "")
    company = ""
    if isinstance(identity.get("current_company"), dict):
        company = identity["current_company"].get("value", "")

    # Clean name — remove parenthetical notes
    name = re.sub(r"\s*\(.*?\)\s*", " ", name).strip()

    source_registry = exec_entry.get("source_registry", {})
    sources = extract_sources(source_registry)
    facts = extract_facts(exec_entry, name)

    return {
        "executive": {
            "name": name,
            "title": title,
            "company": company,
        },
        "sources": sources,
        "facts": facts,
        "metadata": {
            "original_format": "executive_intelligence_object",
            "version": exec_entry.get("executive_intelligence_object_version", "1.0"),
            "entry_status": exec_entry.get("entry_status", "verified_curated"),
        },
    }


def main():
    input_dir = os.path.join(os.path.dirname(__file__), "extracted")
    output_dir = os.path.join(os.path.dirname(__file__), "converted")
    os.makedirs(output_dir, exist_ok=True)

    all_packages = []

    for filename in sorted(os.listdir(input_dir)):
        if not filename.endswith(".json"):
            continue
        filepath = os.path.join(input_dir, filename)
        with open(filepath) as fh:
            data = json.load(fh)

        if "executives" in data:
            for exec_entry in data["executives"]:
                pkg = convert_executive(exec_entry)
                all_packages.append(pkg)
        elif "identity" in data:
            pkg = convert_executive(data)
            all_packages.append(pkg)

    # Write each package as an individual file named after the executive
    for pkg in all_packages:
        name = pkg["executive"]["name"]
        safe_name = re.sub(r"[^a-zA-Z0-9]+", "_", name).strip("_").lower()
        outfile = os.path.join(output_dir, f"{safe_name}.json")
        with open(outfile, "w") as fh:
            json.dump(pkg, fh, indent=2, ensure_ascii=False)
        print(f"  {safe_name}.json — {len(pkg['sources'])} sources, {len(pkg['facts'])} facts")

    # Also write a batch file with all packages
    batch_file = os.path.join(output_dir, "all_packages.json")
    with open(batch_file, "w") as fh:
        json.dump(all_packages, fh, indent=2, ensure_ascii=False)

    print(f"\nTotal: {len(all_packages)} packages written to {output_dir}/")
    print(f"Batch file: {batch_file}")


if __name__ == "__main__":
    main()
