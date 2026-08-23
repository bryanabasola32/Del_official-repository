'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FileText, ShieldCheck, Users, ExternalLink, Search,
  ChevronDown, ChevronRight, Lightbulb, Award,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IntelligenceDetailData, SourceFilter } from './types';
import type { Source } from '@/lib/types';

export function EvidenceSection({ data }: { data: IntelligenceDetailData }) {
  const { execReport, sources } = data;
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [showAllSources, setShowAllSources] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');
  const [expandedSource, setExpandedSource] = useState<string | null>(null);

  const allSources = useMemo(() => {
    return Array.from(new Map(Object.values(sources).flat().map((s) => [s.id, s])).values());
  }, [sources]);

  const tier1Sources = allSources.filter((s) => s.source_tier === 1);
  const tier2Sources = allSources.filter((s) => s.source_tier === 2);
  const tier3Sources = allSources.filter((s) => s.source_tier === 3);

  const filteredSources = useMemo(() => {
    let result = allSources;
    if (sourceFilter === 'official') result = tier1Sources;
    else if (sourceFilter === 'professional') result = tier2Sources;
    else if (sourceFilter === 'news') result = tier3Sources;
    if (sourceSearch) {
      const q = sourceSearch.toLowerCase();
      result = result.filter((s) =>
        (s.source_name || '').toLowerCase().includes(q) ||
        (s.title || '').toLowerCase().includes(q) ||
        (s.snippet || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [allSources, tier1Sources, tier2Sources, tier3Sources, sourceFilter, sourceSearch]);

  const visibleSources = showAllSources ? filteredSources : filteredSources.slice(0, 8);

  const opportunities = execReport?.opportunities ?? [];

  return (
    <div className="space-y-4">
      {/* Research Evidence */}
      {allSources.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <FileText className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold">Research Evidence</h2>
          </div>

          {/* Source counts */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <SourceCountCard label="Official Sources" count={tier1Sources.length} icon={ShieldCheck} />
            <SourceCountCard label="Professional Profiles" count={tier2Sources.length} icon={Users} />
            <SourceCountCard label="News & Publications" count={tier3Sources.length} icon={FileText} />
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <div className="flex gap-2">
              {(['all', 'official', 'professional', 'news'] as SourceFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSourceFilter(filter)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                    sourceFilter === filter
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70'
                  )}
                >
                  {filter}
                </button>
              ))}
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={sourceSearch}
                onChange={(e) => setSourceSearch(e.target.value)}
                placeholder="Search sources..."
                className="pl-9 h-8 text-xs"
              />
            </div>
          </div>

          {/* Source list */}
          <div className="space-y-2">
            {visibleSources.map((src) => (
              <SourceRow
                key={src.id}
                source={src}
                expanded={expandedSource === src.id}
                onToggle={() => setExpandedSource(expandedSource === src.id ? null : src.id)}
              />
            ))}
          </div>
          {!showAllSources && filteredSources.length > 8 && (
            <div className="text-center mt-3">
              <Button variant="ghost" size="sm" onClick={() => setShowAllSources(true)}>
                View All Sources ({filteredSources.length})
                <ChevronRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          )}
          {showAllSources && filteredSources.length > 8 && (
            <div className="text-center mt-3">
              <Button variant="ghost" size="sm" onClick={() => setShowAllSources(false)}>
                Show Less
                <ChevronDown className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Executive Insights / Opportunities */}
      {opportunities.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <Lightbulb className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold">Executive Insights</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {opportunities.map((opp, i) => (
              <div key={i} className="rounded-xl border border-border p-4 hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">{opp.type.replace(/_/g, ' ')}</Badge>
                  <Badge variant="outline" className="text-[10px] shrink-0">{opp.confidence}% confidence</Badge>
                </div>
                <p className="text-sm">{opp.value}</p>
                {opp.reasoning && <p className="text-xs text-muted-foreground mt-2 italic line-clamp-3">{opp.reasoning}</p>}
                {opp.suggestedEventThemes && opp.suggestedEventThemes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {opp.suggestedEventThemes.slice(0, 3).map((theme, j) => (
                      <Badge key={j} variant="outline" className="text-[10px]">{theme}</Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function SourceCountCard({ label, count, icon: Icon }: { label: string; count: number; icon: React.ElementType }) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <Icon className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
      <div className="text-xl font-bold">{count}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

function SourceRow({ source, expanded, onToggle }: { source: Source; expanded: boolean; onToggle: () => void }) {
  const tierLabels: Record<number, string> = {
    1: 'Official',
    2: 'Professional',
    3: 'News',
  };
  const tierColors: Record<number, string> = {
    1: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    2: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    3: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted/20 transition-colors text-left"
      >
        <Badge className={cn('shrink-0 text-[10px]', tierColors[source.source_tier])}>
          {tierLabels[source.source_tier] || `Tier ${source.source_tier}`}
        </Badge>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{source.source_name || source.title || 'Untitled'}</div>
          {source.snippet && !expanded && <div className="text-xs text-muted-foreground truncate">{source.snippet}</div>}
        </div>
        {source.url && (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-0.5 text-xs text-primary hover:underline shrink-0"
          >
            <ExternalLink className="h-3 w-3" />
            View
          </a>
        )}
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 animate-slide-up">
          {source.snippet && (
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Relevant Intelligence</span>
              <p className="text-xs text-muted-foreground mt-0.5">{source.snippet}</p>
            </div>
          )}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>Found: {new Date(source.date_found).toLocaleDateString()}</span>
            {source.url && <span className="truncate">URL: {source.url}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
