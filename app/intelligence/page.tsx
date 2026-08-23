'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Brain, Search, ChevronRight, Clock, Building2, Filter,
  MoreVertical, Eye, RefreshCw, CheckCircle2, ArrowUpDown,
  ArrowUp, ArrowDown, ChevronLeft,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';
import type { Contact, EventItem } from '@/lib/types';
import { PersonaConfidenceBadge } from '@/components/Badges';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { generateExecutiveIntelligence } from '@/services/orchestrator';
import { toast } from 'sonner';
import { IntelligenceStatusBadge, getIntelligenceState, type IntelligenceState } from '@/components/ExecutiveIntelligenceBadge';

type SortField = 'name' | 'company' | 'persona_type' | 'confidence' | 'last_generated';
type SortDir = 'asc' | 'desc';
type ConfidenceFilter = 'all' | 'high' | 'medium' | 'low';
type StatusFilter = 'all' | IntelligenceState;
type EventFilter = 'all' | 'assigned' | 'not_assigned';

const PAGE_SIZE = 10;

export default function IntelligenceListPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [events, setEvents] = useState<Record<string, EventItem>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('last_generated');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [generating, setGenerating] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .in('persona_status', ['completed', 'low_confidence', 'needs_review', 'synthesizing', 'searching', 'retrieved', 'pending'])
      .order('updated_at', { ascending: false });
    setContacts(data || []);

    const { data: eventData } = await supabase.from('events').select('*');
    const eventMap: Record<string, EventItem> = {};
    for (const e of eventData || []) {
      eventMap[e.id] = e;
    }
    setEvents(eventMap);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const industries = useMemo(() => {
    const set = new Set(contacts.map((c) => c.industry).filter((v): v is string => !!v));
    return Array.from(set).sort();
  }, [contacts]);

  const getIntelligenceStatus = (c: Contact): IntelligenceState => getIntelligenceState(c);

  const filtered = useMemo(() => {
    let result = contacts;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        (c.persona_type || '').toLowerCase().includes(q) ||
        (c.industry || '').toLowerCase().includes(q)
      );
    }

    if (confidenceFilter !== 'all') {
      result = result.filter((c) => c.persona_confidence_level === confidenceFilter);
    }

    if (statusFilter !== 'all') {
      result = result.filter((c) => getIntelligenceStatus(c) === statusFilter);
    }

    if (industryFilter !== 'all') {
      result = result.filter((c) => c.industry === industryFilter);
    }

    if (eventFilter === 'assigned') {
      result = result.filter((c) => c.assigned_event_id);
    } else if (eventFilter === 'not_assigned') {
      result = result.filter((c) => !c.assigned_event_id);
    }

    return [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'company') cmp = a.company.localeCompare(b.company);
      else if (sortField === 'persona_type') cmp = (a.persona_type || '').localeCompare(b.persona_type || '');
      else if (sortField === 'confidence') cmp = (a.persona_confidence_pct || 0) - (b.persona_confidence_pct || 0);
      else if (sortField === 'last_generated') {
        cmp = new Date(a.last_researched_date || 0).getTime() - new Date(b.last_researched_date || 0).getTime();
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [contacts, search, confidenceFilter, statusFilter, industryFilter, eventFilter, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleGenerate = async (contact: Contact) => {
    setGenerating(contact.id);
    toast.info(`Generating intelligence for ${contact.name}...`);
    try {
      await generateExecutiveIntelligence(contact.id);
      toast.success(`Intelligence generated for ${contact.name}`);
      fetchData();
    } catch {
      toast.error(`Failed to generate intelligence for ${contact.name}`);
    } finally {
      setGenerating(null);
    }
  };

  const hasActiveFilters = search || confidenceFilter !== 'all' || statusFilter !== 'all' || industryFilter !== 'all' || eventFilter !== 'all';

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Executive Intelligence</h1>
        <p className="text-sm text-muted-foreground mt-1">AI-generated intelligence repository — personas, pain points, and event recommendations</p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by executive, company, persona, or industry..."
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={confidenceFilter} onValueChange={(v) => { setConfidenceFilter(v as ConfidenceFilter); setPage(1); }}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="Confidence" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Confidence</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as StatusFilter); setPage(1); }}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="needs_review">Needs Review</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="drafted">Invitation Drafted</SelectItem>
            </SelectContent>
          </Select>
          <Select value={industryFilter} onValueChange={(v) => { setIndustryFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="Industry" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Industries</SelectItem>
              {industries.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={eventFilter} onValueChange={(v) => { setEventFilter(v as EventFilter); setPage(1); }}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Event" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="not_assigned">Not Assigned</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <SortableHeader label="Executive" field="name" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Company" field="company" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Persona</th>
                <SortableHeader label="Confidence" field="confidence" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Sources</th>
                <SortableHeader label="Last Generated" field="last_generated" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="hidden xl:table-cell" />
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Recommendation</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="p-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="p-6"><TableSkeleton rows={8} cols={9} /></td></tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    {hasActiveFilters ? (
                      <EmptyState icon={Filter} title="No matching intelligence" description="Try adjusting your search or filters to find what you're looking for." />
                    ) : (
                      <EmptyState
                        icon={Brain}
                        title="No executive intelligence has been generated"
                        description="Generate intelligence from the Executive List to populate this repository with AI-powered personas and recommendations."
                        action={{ label: 'Go to Executive List', href: '/executives' }}
                      />
                    )}
                  </td>
                </tr>
              ) : paged.map((contact) => {
                const status = getIntelligenceStatus(contact);
                const assignedEvent = contact.assigned_event_id ? events[contact.assigned_event_id] : null;
                return (
                  <tr
                    key={contact.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => router.push(`/intelligence/${contact.id}`)}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">
                          {contact.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{contact.name}</div>
                          <div className="text-xs text-muted-foreground">{contact.title || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 text-sm">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {contact.company}
                      </div>
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      {contact.persona_type ? (
                        <span className="text-sm font-medium">{contact.persona_type}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      {contact.persona_confidence_level ? (
                        <PersonaConfidenceBadge level={contact.persona_confidence_level} pct={contact.persona_confidence_pct} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 hidden lg:table-cell">
                      {contact.sources_verified_count != null ? (
                        <span className="text-sm font-medium">{contact.sources_verified_count}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 hidden xl:table-cell text-xs text-muted-foreground">
                      {contact.last_researched_date ? (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(contact.last_researched_date).toLocaleDateString()}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="p-3 hidden lg:table-cell">
                      {assignedEvent ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-xs font-medium truncate max-w-[120px]">{assignedEvent.event_name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not assigned</span>
                      )}
                    </td>
                    <td className="p-3">
                      <IntelligenceStatusBadge state={status} />
                    </td>
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/intelligence/${contact.id}`)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Intelligence
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleGenerate(contact)} disabled={generating === contact.id}>
                            <RefreshCw className={cn('h-4 w-4 mr-2', generating === contact.id && 'animate-spin')} />
                            {generating === contact.id ? 'Generating...' : 'Regenerate'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SortableHeader({ label, field, sortField, sortDir, onSort, className }: {
  label: string; field: SortField; sortField: SortField; sortDir: SortDir; onSort: (f: SortField) => void; className?: string;
}) {
  const isActive = sortField === field;
  return (
    <th className={cn('text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider', className)}>
      <button onClick={() => onSort(field)} className="flex items-center gap-1 hover:text-foreground transition-colors">
        {label}
        {isActive ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    </th>
  );
}
