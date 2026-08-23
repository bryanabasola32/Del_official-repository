'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays, Plus, Building2, ChevronRight, Search, Upload,
  MoreVertical, Eye, ArrowUpDown, ArrowUp, ArrowDown, Users, Clock,
  TrendingUp, Mail, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/lib/supabase';
import type { EventItem } from '@/lib/types';
import {
  fetchEventIntelligenceBatch, getCampaignStatus,
  SCORE_THRESHOLDS,
  type EventIntelligence, type CampaignStatus, type MatchTier,
} from '@/lib/eventIntelligence';
import { CreateEventDialog } from '@/components/CreateEventDialog';
import { ImportEventsDialog } from '@/components/ImportEventsDialog';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

type SortField = 'event_name' | 'date' | 'high_fit' | 'avg_score' | 'approved' | 'campaign';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'all' | 'draft' | 'upcoming' | 'ready' | 'completed';
type CampaignFilter = 'all' | CampaignStatus;
type MatchFilter = 'all' | 'high' | 'medium' | 'low' | 'none';
type DateFilter = 'all' | 'upcoming' | 'this_week' | 'this_month' | 'past';

const PAGE_SIZE = 10;

export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [intelMap, setIntelMap] = useState<Record<string, EventIntelligence>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [campaignFilter, setCampaignFilter] = useState<CampaignFilter>('all');
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('events').select('*').order('date', { ascending: true });
    const eventsData = (data || []) as EventItem[];
    setEvents(eventsData);

    if (eventsData.length > 0) {
      const intel = await fetchEventIntelligenceBatch(eventsData.map((e) => e.id));
      setIntelMap(intel);
    } else {
      setIntelMap({});
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const kpi = useMemo(() => {
    let activeEvents = 0;
    let highFitProspects = 0;
    let awaitingReview = 0;
    let invitationsReady = 0;
    for (const e of events) {
      if (e.status !== 'upcoming' && e.status !== 'active') continue;
      activeEvents++;
      const intel = intelMap[e.id];
      if (!intel) continue;
      highFitProspects += intel.highFit;
      awaitingReview += intel.pendingReview;
      invitationsReady += intel.invitationCount;
    }
    return { activeEvents, highFitProspects, awaitingReview, invitationsReady };
  }, [events, intelMap]);

  const industries = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => (e.target_industries || []).forEach((i) => set.add(i)));
    return Array.from(set).sort();
  }, [events]);

  const filtered = useMemo(() => {
    let result = events;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((e) =>
        e.event_name.toLowerCase().includes(q) ||
        (e.organizer || '').toLowerCase().includes(q) ||
        (e.target_industries || []).some((i) => i.toLowerCase().includes(q)),
      );
    }

    if (statusFilter !== 'all') {
      const statusMap: Record<StatusFilter, string[]> = {
        all: [],
        draft: ['draft'],
        upcoming: ['upcoming', 'active'],
        ready: ['ready'],
        completed: ['completed', 'past'],
      };
      const statuses = statusMap[statusFilter];
      if (statuses.length) result = result.filter((e) => statuses.includes(e.status));
    }

    if (industryFilter !== 'all') {
      result = result.filter((e) => (e.target_industries || []).includes(industryFilter));
    }

    if (campaignFilter !== 'all') {
      result = result.filter((e) => {
        const intel = intelMap[e.id];
        if (!intel) return campaignFilter === 'not_started';
        return getCampaignStatus(e, intel).status === campaignFilter;
      });
    }

    if (matchFilter !== 'all') {
      result = result.filter((e) => {
        const intel = intelMap[e.id];
        if (!intel || intel.totalAnalyzed === 0) return matchFilter === 'none';
        if (matchFilter === 'high') return intel.highFit > 0;
        if (matchFilter === 'medium') return intel.mediumFit > 0;
        if (matchFilter === 'low') return intel.lowFit > 0;
        return true;
      });
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      result = result.filter((e) => {
        if (!e.date) return false;
        const d = new Date(e.date);
        if (dateFilter === 'upcoming') return d >= now;
        if (dateFilter === 'this_week') return d >= startOfWeek && d < endOfWeek;
        if (dateFilter === 'this_month') return d >= startOfMonth && d < endOfMonth;
        if (dateFilter === 'past') return d < now;
        return true;
      });
    }

    return [...result].sort((a, b) => {
      let cmp = 0;
      const intelA = intelMap[a.id];
      const intelB = intelMap[b.id];
      if (sortField === 'event_name') cmp = a.event_name.localeCompare(b.event_name);
      else if (sortField === 'date') cmp = new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
      else if (sortField === 'high_fit') cmp = (intelA?.highFit || 0) - (intelB?.highFit || 0);
      else if (sortField === 'avg_score') cmp = (intelA?.averageScore || 0) - (intelB?.averageScore || 0);
      else if (sortField === 'approved') cmp = (intelA?.approvedCount || 0) - (intelB?.approvedCount || 0);
      else if (sortField === 'campaign') {
        cmp = (intelA ? getCampaignStatus(a, intelA).status : 'not_started')
          .localeCompare(intelB ? getCampaignStatus(b, intelB).status : 'not_started');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [events, intelMap, search, statusFilter, industryFilter, campaignFilter, matchFilter, dateFilter, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const hasActiveFilters = search || statusFilter !== 'all' || industryFilter !== 'all'
    || campaignFilter !== 'all' || matchFilter !== 'all' || dateFilter !== 'all';

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Event Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage events, understand audience potential, and activate high-intent executives.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import Events
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Event
          </Button>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPICard
          icon={CalendarDays}
          label="Active Events"
          value={loading ? '—' : kpi.activeEvents}
          context="Currently scheduled"
        />
        <KPICard
          icon={TrendingUp}
          label="High-Fit Prospects"
          value={loading ? '—' : kpi.highFitProspects}
          context="Across active events"
        />
        <KPICard
          icon={AlertCircle}
          label="Awaiting Review"
          value={loading ? '—' : kpi.awaitingReview}
          context="Recommendations pending"
        />
        <KPICard
          icon={Mail}
          label="Invitations Ready"
          value={loading ? '—' : kpi.invitationsReady}
          context="Drafts persisted"
        />
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by event name, organizer, or industry..."
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={campaignFilter} onValueChange={(v) => { setCampaignFilter(v as CampaignFilter); setPage(1); }}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Campaign" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campaigns</SelectItem>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="needs_review">Needs Review</SelectItem>
              <SelectItem value="ready_to_invite">Ready to Invite</SelectItem>
              <SelectItem value="invitations_ready">Invitations Ready</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={matchFilter} onValueChange={(v) => { setMatchFilter(v as MatchFilter); setPage(1); }}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Match" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Match Levels</SelectItem>
              <SelectItem value="high">High Match</SelectItem>
              <SelectItem value="medium">Medium Match</SelectItem>
              <SelectItem value="low">Low Match</SelectItem>
              <SelectItem value="none">No Audience Yet</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={(v) => { setDateFilter(v as DateFilter); setPage(1); }}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="Date" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="past">Past</SelectItem>
            </SelectContent>
          </Select>
          <Select value={industryFilter} onValueChange={(v) => { setIndustryFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Industry" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Industries</SelectItem>
              {industries.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
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
                <SortableHeader label="Event" field="event_name" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Date" field="date" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Audience" field="high_fit" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Match" field="avg_score" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Campaign" field="campaign" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <th className="p-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-6"><TableSkeleton rows={8} cols={6} /></td></tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    {hasActiveFilters ? (
                      <EmptyState icon={Search} title="No matching events" description="Try adjusting your search or filters." />
                    ) : (
                      <EmptyState
                        icon={CalendarDays}
                        title="No events have been created"
                        description="Create a new event or import a roster to start matching executives and generating invitations."
                        action={{ label: 'Create Event', onClick: () => setCreateOpen(true) }}
                      />
                    )}
                  </td>
                </tr>
              ) : paged.map((event) => {
                const intel = intelMap[event.id];
                const campaign = getCampaignStatus(event, intel || emptyIntel(event.id));
                return (
                  <tr
                    key={event.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => router.push(`/events/${event.id}`)}
                  >
                    {/* Event */}
                    <td className="p-3">
                      <div className="font-medium text-sm">{event.event_name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        {event.organizer && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{event.organizer}</span>}
                        {event.target_industries && event.target_industries.length > 0 && (
                          <span className="text-muted-foreground/70">· {event.target_industries.slice(0, 2).join(', ')}</span>
                        )}
                      </div>
                    </td>
                    {/* Date */}
                    <td className="p-3 text-sm text-muted-foreground whitespace-nowrap">
                      {event.date ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}
                          </span>
                          {event.time && <span className="text-xs flex items-center gap-1 mt-0.5"><Clock className="h-3 w-3" />{event.time}</span>}
                        </div>
                      ) : '—'}
                    </td>
                    {/* Audience */}
                    <td className="p-3">
                      {intel && intel.totalAnalyzed > 0 ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="cursor-help">
                                <div className="text-sm font-medium">{intel.totalAnalyzed} analyzed</div>
                                <div className="text-xs text-muted-foreground">
                                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">{intel.highFit} high</span>
                                  {' · '}
                                  <span className="text-blue-600 dark:text-blue-400">{intel.mediumFit} med</span>
                                  {' · '}
                                  <span className="text-amber-600 dark:text-amber-400">{intel.lowFit} low</span>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs space-y-0.5">
                                <div className="font-medium">Audience Distribution</div>
                                <div>High-fit (≥{SCORE_THRESHOLDS.high}): {intel.highFit}</div>
                                <div>Medium (≥{SCORE_THRESHOLDS.medium}): {intel.mediumFit}</div>
                                <div>Low (&lt;{SCORE_THRESHOLDS.medium}): {intel.lowFit}</div>
                                <div>Approved: {intel.approvedCount}</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-xs text-muted-foreground">No audience yet</span>
                      )}
                    </td>
                    {/* Match */}
                    <td className="p-3">
                      {intel && intel.averageScore !== null ? (
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{intel.averageScore}<span className="text-xs text-muted-foreground"> / 100</span></span>
                          <span className="text-xs text-muted-foreground">Avg. Match</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No audience yet</span>
                      )}
                    </td>
                    {/* Campaign */}
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        <CampaignBadge status={campaign.status} label={campaign.label} />
                        {intel && intel.approvedCount > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {intel.approvedCount} approved
                            {intel.invitationCount > 0 && ` · ${intel.invitationCount} invites`}
                          </span>
                        )}
                      </div>
                    </td>
                    {/* Action */}
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/events/${event.id}`)}
                          className="text-primary hover:text-primary"
                        >
                          Open Event
                          <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/events/${event.id}`)}>
                              <Eye className="h-4 w-4 mr-2" /> View Details
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
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
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
            <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
          </div>
        </div>
      )}

      <CreateEventDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={fetchEvents} />
      <ImportEventsDialog open={importOpen} onOpenChange={setImportOpen} onImported={fetchEvents} />
    </div>
  );
}

function emptyIntel(eventId: string): EventIntelligence {
  return {
    eventId,
    totalAnalyzed: 0,
    highFit: 0,
    mediumFit: 0,
    lowFit: 0,
    averageScore: null,
    approvedCount: 0,
    pendingReview: 0,
    rejectedCount: 0,
    invitationCount: 0,
  };
}

function SortableHeader({ label, field, sortField, sortDir, onSort, className }: {
  label: string; field: SortField; sortField: SortField; sortDir: SortDir; onSort: (f: SortField) => void; className?: string;
}) {
  const isActive = sortField === field;
  return (
    <th className={cn('text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap', className)}>
      <button onClick={() => onSort(field)} className="flex items-center gap-1 hover:text-foreground transition-colors">
        {label}
        {isActive ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    </th>
  );
}

function KPICard({ icon: Icon, label, value, context }: {
  icon: React.ElementType; label: string; value: string | number; context: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{context}</div>
    </Card>
  );
}

function CampaignBadge({ status, label }: { status: CampaignStatus; label: string }) {
  const config: Record<CampaignStatus, { dot: string; cls: string }> = {
    not_started: { dot: 'bg-slate-400', cls: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700' },
    researching: { dot: 'bg-blue-400', cls: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' },
    needs_review: { dot: 'bg-amber-500', cls: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' },
    ready_to_invite: { dot: 'bg-cyan-500', cls: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800' },
    invitations_ready: { dot: 'bg-violet-500', cls: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800' },
    completed: { dot: 'bg-emerald-500', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' },
  };
  const c = config[status];
  return (
    <Badge className={c.cls}>
      <span className={cn('h-1.5 w-1.5 rounded-full mr-1.5', c.dot)} />
      {label}
    </Badge>
  );
}
