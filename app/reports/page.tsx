'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3, Download, Activity, Mail, Brain, Users, Calendar,
  TrendingUp, FileText, CheckCircle2, Clock, AlertCircle, Loader2, Eye,
  Sparkles, Target, Award, Users2, Building2, ChevronRight, Search,
  XCircle, RefreshCw, FileSpreadsheet, FileType, Send, TestTube,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import type { ActivityLogEntry, EventItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  fetchReportKPIs, fetchExecutiveReportData, fetchRecommendationReportData,
  fetchEventReportData, fetchEventReportDetail, fetchDashboardSummary,
  fetchRecentActivity, fetchActivityHistory,
  type ReportKPIs, type ExecutiveReportRow, type RecommendationReportRow,
  type EventReportRow, type EventReportDetail, type DashboardSummary,
} from '@/lib/reporting/reportMetrics';
import {
  exportCSV, exportXLSX, exportPDF, buildFilename,
  buildExecutivePDF, buildDashboardPDF, buildRecommendationPDF,
  buildEventPDF, buildNarrativePDF,
  type ExportFormat, type PDFReportContent, type ReportExportConfig,
  REPORT_EXPORT_CONFIG,
} from '@/lib/reporting/export';
import {
  generateDashboardNarrative, generateExecutiveNarrative,
  generateRecommendationNarrative, generateEventNarrative,
  type NarrativeMode, type NarrativeResult,
} from '@/lib/reporting/narrative';

type ReportKey = 'executive' | 'relationship' | 'strategic' | 'action' | 'dashboard' | 'recommendations' | 'spreadsheet';

interface PreviewState {
  open: boolean;
  reportKey: ReportKey | null;
  eventReport: EventReportDetail | null;
  loading: boolean;
  error: string | null;
}

interface NarrativeState {
  open: boolean;
  reportKey: ReportKey | null;
  loading: boolean;
  text: string;
  isMock: boolean;
  error: string | null;
  mode: NarrativeMode;
}

const EMPTY_PREVIEW: PreviewState = {
  open: false, reportKey: null, eventReport: null, loading: false, error: null,
};

const EMPTY_NARRATIVE: NarrativeState = {
  open: false, reportKey: null, loading: false, text: '', isMock: false, error: null, mode: 'executive_brief',
};

export default function ReportsPage() {
  const [kpis, setKpis] = useState<ReportKPIs | null>(null);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [eventReports, setEventReports] = useState<EventReportRow[]>([]);
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<PreviewState>(EMPTY_PREVIEW);
  const [narrative, setNarrative] = useState<NarrativeState>(EMPTY_NARRATIVE);
  const [activityHistoryOpen, setActivityHistoryOpen] = useState(false);
  const [eventSearch, setEventSearch] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [k, ds, er, act] = await Promise.all([
        fetchReportKPIs(),
        fetchDashboardSummary(),
        fetchEventReportData(),
        fetchRecentActivity(8),
      ]);
      setKpis(k);
      setDashboard(ds);
      setEventReports(er);
      setActivity(act);
    } catch {
      toast.error('Failed to load report data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const setExportLoading = (key: string, isLoading: boolean) => {
    setExporting((prev) => {
      const next = new Set(prev);
      if (isLoading) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  // ── Export handlers ──

  const handleExport = async (reportKey: ReportKey, format: ExportFormat) => {
    const key = `${reportKey}-${format}`;
    setExportLoading(key, true);
    try {
      if (reportKey === 'executive') {
        const rows = await fetchExecutiveReportData();
        if (format === 'csv') exportCSV(buildFilename('executive-intelligence', 'csv'), rows as unknown as Record<string, unknown>[]);
        else if (format === 'pdf') await exportPDF(buildFilename('executive-intelligence', 'pdf'), buildExecutivePDF(rows));
      } else if (reportKey === 'dashboard') {
        const summary = await fetchDashboardSummary();
        if (format === 'csv') {
          exportCSV(buildFilename('dashboard-summary', 'csv'), [
            { metric: 'Executives Analyzed', value: summary.kpis.executivesAnalyzed },
            { metric: 'High-Fit Matches', value: summary.kpis.highFitMatches },
            { metric: 'Approved Attendees', value: summary.kpis.approvedAttendees },
            { metric: 'Invitation Drafts', value: summary.kpis.invitationDrafts },
            { metric: 'Industries Represented', value: summary.industriesRepresented },
            { metric: 'Total Events', value: summary.totalEvents },
            { metric: 'Active Events', value: summary.activeEvents },
            { metric: 'Average Match Score', value: summary.averageMatchScore ?? 'N/A' },
          ]);
        } else if (format === 'pdf') {
          await exportPDF(buildFilename('dashboard-summary', 'pdf'), buildDashboardPDF(summary));
        }
      } else if (reportKey === 'recommendations') {
        const rows = await fetchRecommendationReportData();
        if (format === 'csv') exportCSV(buildFilename('recommendation-analysis', 'csv'), rows as unknown as Record<string, unknown>[]);
        else if (format === 'pdf') await exportPDF(buildFilename('recommendation-analysis', 'pdf'), buildRecommendationPDF(rows));
      } else if (reportKey === 'spreadsheet') {
        const rows = await fetchExecutiveReportData();
        if (format === 'csv') exportCSV(buildFilename('enhanced-executive-dataset', 'csv'), rows as unknown as Record<string, unknown>[]);
        else if (format === 'xlsx') await exportXLSX(buildFilename('enhanced-executive-dataset', 'xlsx'), rows as unknown as Record<string, unknown>[], 'Executives');
      }
      toast.success(`${REPORT_EXPORT_CONFIG[reportKey].title} downloaded.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export report.');
    } finally {
      setExportLoading(key, false);
    }
  };

  const handleExportEvent = async (eventId: string, eventName: string, format: ExportFormat) => {
    const key = `event-${eventId}-${format}`;
    setExportLoading(key, true);
    try {
      const detail = await fetchEventReportDetail(eventId);
      if (!detail) { toast.error('Event not found.'); return; }
      if (format === 'csv') {
        exportCSV(buildFilename(`event-${eventName}`, 'csv'), detail.recommendations as unknown as Record<string, unknown>[]);
      } else if (format === 'pdf') {
        await exportPDF(buildFilename(`event-${eventName}`, 'pdf'), buildEventPDF(eventName, detail.intel, detail.recommendations));
      }
      toast.success(`Event report for ${eventName} downloaded.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export event report.');
    } finally {
      setExportLoading(key, false);
    }
  };

  // ── Preview handlers ──

  const openPreview = async (reportKey: ReportKey) => {
    setPreview({ ...EMPTY_PREVIEW, open: true, reportKey, loading: true });
  };

  const openEventPreview = async (eventId: string) => {
    setPreview({ ...EMPTY_PREVIEW, open: true, reportKey: null, eventReport: null, loading: true });
    try {
      const detail = await fetchEventReportDetail(eventId);
      setPreview((prev) => ({ ...prev, loading: false, eventReport: detail }));
    } catch (err) {
      setPreview((prev) => ({ ...prev, loading: false, error: err instanceof Error ? err.message : 'Failed to load report.' }));
    }
  };

  const closePreview = () => setPreview(EMPTY_PREVIEW);

  // ── Narrative handlers ──

  const openNarrative = (reportKey: ReportKey) => {
    setNarrative({ ...EMPTY_NARRATIVE, open: true, reportKey, mode: 'executive_brief' });
  };

  const generateNarrative = async (mode: NarrativeMode) => {
    if (!narrative.reportKey) return;
    setNarrative((prev) => ({ ...prev, loading: true, mode, text: '', error: null }));
    try {
      let result: NarrativeResult;
      if (narrative.reportKey === 'dashboard') {
        const summary = dashboard || await fetchDashboardSummary();
        result = await generateDashboardNarrative(summary, mode);
      } else if (narrative.reportKey === 'executive') {
        const rows = await fetchExecutiveReportData();
        result = await generateExecutiveNarrative(rows, mode);
      } else if (narrative.reportKey === 'recommendations') {
        const rows = await fetchRecommendationReportData();
        result = await generateRecommendationNarrative(rows, mode);
      } else {
        result = { text: 'Narrative not available for this report type.', isMock: true };
      }
      setNarrative((prev) => ({ ...prev, loading: false, text: result.text, isMock: result.isMock, error: result.error ?? null }));
    } catch (err) {
      setNarrative((prev) => ({ ...prev, loading: false, error: err instanceof Error ? err.message : 'Narrative generation failed.' }));
    }
  };

  const exportNarrative = async () => {
    if (!narrative.text) return;
    const key = 'narrative-pdf';
    setExportLoading(key, true);
    try {
      const config = narrative.reportKey ? REPORT_EXPORT_CONFIG[narrative.reportKey] : null;
      const title = config?.title || 'Narrative Executive Brief';
      await exportPDF(buildFilename('narrative-brief', 'pdf'), buildNarrativePDF(title, narrative.text));
      toast.success('Narrative brief downloaded as PDF.');
    } catch {
      toast.error('Failed to export narrative PDF.');
    } finally {
      setExportLoading(key, false);
    }
  };

  const closeNarrative = () => setNarrative(EMPTY_NARRATIVE);

  // ── Filtered event reports ──
  const filteredEventReports = useMemo(() => {
    if (!eventSearch) return eventReports;
    const q = eventSearch.toLowerCase();
    return eventReports.filter((e) => e.event_name.toLowerCase().includes(q));
  }, [eventReports, eventSearch]);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="mb-6">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-48 w-full mb-6" />
        <Skeleton className="h-64 w-full mb-6" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Intelligence summaries, campaign outcomes, activity history, and exportable reports.
        </p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KPICard icon={Users2} label="Executives Analyzed" value={kpis?.executivesAnalyzed ?? '—'} context="With intelligence available" />
        <KPICard icon={TrendingUp} label="High-Fit Matches" value={kpis?.highFitMatches ?? '—'} context="Score ≥ 85" />
        <KPICard icon={CheckCircle2} label="Approved Attendees" value={kpis?.approvedAttendees ?? '—'} context="Manager-approved" />
        <KPICard icon={Mail} label="Invitation Drafts" value={kpis?.invitationDrafts ?? '—'} context="Persisted drafts" />
      </div>

      {/* Intelligence Reports */}
      <Card className="p-5 mb-6">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Brain className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Intelligence Reports</h2>
            <p className="text-xs text-muted-foreground">Executive personas, relationship context, strategic decisions, and action intelligence.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ReportCard
            title="Executive Intelligence"
            description="Executive personas, confidence, evidence, and key findings."
            recordCount={kpis?.executivesAnalyzed}
            formats={['pdf', 'csv']}
            onPreview={() => openPreview('executive')}
            onExport={(fmt) => handleExport('executive', fmt)}
            onNarrative={() => openNarrative('executive')}
            exporting={exporting}
            reportKey="executive"
          />
          <ReportCard
            title="Relationship Intelligence"
            description="Relationship context, engagement readiness, and relationship intelligence."
            formats={['pdf', 'csv']}
            onPreview={() => openPreview('executive')}
            onExport={(fmt) => handleExport('executive', fmt)}
            onNarrative={() => openNarrative('executive')}
            exporting={exporting}
            reportKey="relationship"
          />
          <ReportCard
            title="Strategic Decision Analysis"
            description="Strategic decision reasoning and event/opportunity evaluation."
            formats={['pdf', 'csv']}
            onPreview={() => openPreview('recommendations')}
            onExport={(fmt) => handleExport('recommendations', fmt)}
            onNarrative={() => openNarrative('recommendations')}
            exporting={exporting}
            reportKey="strategic"
          />
          <ReportCard
            title="Action Intelligence"
            description="Recommended actions and follow-up intelligence."
            formats={['pdf', 'csv']}
            onPreview={() => openPreview('recommendations')}
            onExport={(fmt) => handleExport('recommendations', fmt)}
            onNarrative={() => openNarrative('recommendations')}
            exporting={exporting}
            reportKey="action"
          />
        </div>
      </Card>

      {/* Operational Reports */}
      <Card className="p-5 mb-6">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Operational Reports</h2>
            <p className="text-xs text-muted-foreground">Dashboard summary, recommendation analysis, and structured datasets.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ReportCard
            title="Dashboard Summary"
            description="Overall DEL intelligence and campaign metrics."
            formats={['pdf', 'csv']}
            onPreview={() => openPreview('dashboard')}
            onExport={(fmt) => handleExport('dashboard', fmt)}
            onNarrative={() => openNarrative('dashboard')}
            exporting={exporting}
            reportKey="dashboard"
          />
          <ReportCard
            title="Recommendation Analysis"
            description="Event matching, executive recommendations, and score distribution."
            recordCount={kpis?.highFitMatches}
            formats={['pdf', 'csv']}
            onPreview={() => openPreview('recommendations')}
            onExport={(fmt) => handleExport('recommendations', fmt)}
            onNarrative={() => openNarrative('recommendations')}
            exporting={exporting}
            reportKey="recommendations"
          />
          <ReportCard
            title="Enhanced Executive Dataset"
            description="Structured executive/persona dataset for spreadsheet export."
            recordCount={kpis?.executivesAnalyzed}
            formats={['xlsx', 'csv']}
            onPreview={() => openPreview('spreadsheet')}
            onExport={(fmt) => handleExport('spreadsheet', fmt)}
            exporting={exporting}
            reportKey="spreadsheet"
          />
        </div>
      </Card>

      {/* Event Reports */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Event Reports</h2>
              <p className="text-xs text-muted-foreground">Audience analysis, match quality, and campaign progress per event.</p>
            </div>
          </div>
          <div className="relative w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={eventSearch}
              onChange={(e) => setEventSearch(e.target.value)}
              placeholder="Search events..."
              className="pl-9 h-8 text-sm"
            />
          </div>
        </div>

        {filteredEventReports.length === 0 ? (
          <EmptyState icon={Calendar} title="No events found" description={eventSearch ? "Try adjusting your search." : "No events have been created yet."} />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Event</th>
                  <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Date</th>
                  <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Audience</th>
                  <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">High-Fit</th>
                  <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Avg Match</th>
                  <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Approved</th>
                  <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Invites</th>
                  <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Campaign</th>
                  <th className="text-right p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEventReports.map((er) => (
                  <tr key={er.event_id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="p-2">
                      <button onClick={() => openEventPreview(er.event_id)} className="text-sm font-medium hover:underline text-left">
                        {er.event_name}
                      </button>
                    </td>
                    <td className="p-2 hidden md:table-cell text-sm text-muted-foreground whitespace-nowrap">
                      {er.date ? new Date(er.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                    </td>
                    <td className="p-2 text-sm">{er.total_analyzed > 0 ? er.total_analyzed : '—'}</td>
                    <td className="p-2 hidden lg:table-cell text-sm">
                      {er.high_fit > 0 ? <span className="text-emerald-600 dark:text-emerald-400 font-medium">{er.high_fit}</span> : '—'}
                    </td>
                    <td className="p-2 hidden lg:table-cell text-sm">
                      {er.average_score !== null ? `${er.average_score}/100` : '—'}
                    </td>
                    <td className="p-2 hidden xl:table-cell text-sm">
                      {er.approved > 0 ? <span className="text-cyan-600 dark:text-cyan-400 font-medium">{er.approved}</span> : '—'}
                    </td>
                    <td className="p-2 hidden xl:table-cell text-sm">
                      {er.invitation_drafts > 0 ? <span className="text-violet-600 dark:text-violet-400 font-medium">{er.invitation_drafts}</span> : '—'}
                    </td>
                    <td className="p-2">
                      <CampaignBadge status={er.campaign_status} />
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEventPreview(er.event_id)} title="View Report">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleExportEvent(er.event_id, er.event_name, 'pdf')} disabled={exporting.has(`event-${er.event_id}-pdf`)} title="Export PDF">
                          {exporting.has(`event-${er.event_id}-pdf`) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileType className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleExportEvent(er.event_id, er.event_name, 'csv')} disabled={exporting.has(`event-${er.event_id}-csv`)} title="Export CSV">
                          {exporting.has(`event-${er.event_id}-csv`) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Recent Activity */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Activity className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold">Recent Activity</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setActivityHistoryOpen(true)}>
            View All Activity
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
        {activity.length === 0 ? (
          <EmptyState icon={BarChart3} title="No activity yet" description="Activity will appear here once you start importing executives, generating intelligence, or sending invitations." />
        ) : (
          <div className="space-y-2">
            {activity.slice(0, 8).map((entry) => (
              <ActivityRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </Card>

      {/* Report Preview Sheet */}
      <Sheet open={preview.open} onOpenChange={(open) => !open && closePreview()}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {preview.eventReport ? `Event Report: ${preview.eventReport.event.event_name}` : preview.reportKey ? REPORT_EXPORT_CONFIG[preview.reportKey]?.title : 'Report'}
            </SheetTitle>
            <SheetDescription>Report preview with summary, analysis, and detailed records.</SheetDescription>
          </SheetHeader>

          {preview.loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            </div>
          ) : preview.error ? (
            <div className="py-8">
              <div className="flex items-center gap-2 text-destructive mb-4">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm font-medium">{preview.error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={closePreview}>Close</Button>
            </div>
          ) : preview.eventReport ? (
            <EventReportPreview detail={preview.eventReport} onExport={(fmt) => handleExportEvent(preview.eventReport!.event.id, preview.eventReport!.event.event_name, fmt)} exporting={exporting} />
          ) : preview.reportKey ? (
            <StandardReportPreview reportKey={preview.reportKey} onExport={(fmt) => handleExport(preview.reportKey!, fmt)} exporting={exporting} onNarrative={() => openNarrative(preview.reportKey!)} />
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Narrative Dialog */}
      <Dialog open={narrative.open} onOpenChange={(open) => !open && closeNarrative()}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Narrative — {narrative.reportKey ? REPORT_EXPORT_CONFIG[narrative.reportKey]?.title : ''}
            </DialogTitle>
            <DialogDescription>
              Generated from existing DEL intelligence. Does not modify scores, confidence, or recommendations.
            </DialogDescription>
          </DialogHeader>

          {!narrative.text && !narrative.loading && (
            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-4">
                Generate an AI narrative report from the existing DEL intelligence data. Choose a format:
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => generateNarrative('concise')}>Concise (3-5 sentences)</Button>
                <Button size="sm" onClick={() => generateNarrative('executive_brief')}>Executive Brief (1 page)</Button>
                <Button size="sm" variant="outline" onClick={() => generateNarrative('detailed')}>Detailed (2-4 pages)</Button>
              </div>
            </div>
          )}

          {narrative.loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
              <span className="text-sm text-muted-foreground ml-3">Generating narrative...</span>
            </div>
          )}

          {narrative.text && !narrative.loading && (
            <div>
              {narrative.error && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10 p-3 mb-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">{narrative.error}</p>
                  </div>
                </div>
              )}
              {narrative.isMock && !narrative.error && (
                <div className="rounded-lg border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/10 p-3 mb-4">
                  <p className="text-xs text-blue-700 dark:text-blue-400">AI provider not configured. Showing structured summary instead.</p>
                </div>
              )}
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                {narrative.text}
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                <Button size="sm" variant="outline" onClick={() => generateNarrative(narrative.mode)}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Regenerate
                </Button>
                <Button size="sm" onClick={exportNarrative} disabled={exporting.has('narrative-pdf')}>
                  {exporting.has('narrative-pdf') ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileType className="h-3.5 w-3.5 mr-1.5" />}
                  Export PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Activity History Dialog */}
      <ActivityHistoryDialog open={activityHistoryOpen} onOpenChange={setActivityHistoryOpen} />
    </div>
  );
}

// ── Sub-components ──

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

function ReportCard({ title, description, recordCount, formats, onPreview, onExport, onNarrative, exporting, reportKey }: {
  title: string;
  description: string;
  recordCount?: number;
  formats: ExportFormat[];
  onPreview: () => void;
  onExport: (format: ExportFormat) => void;
  onNarrative?: () => void;
  exporting: Set<string>;
  reportKey: string;
}) {
  const formatIcons: Record<ExportFormat, React.ElementType> = {
    pdf: FileType,
    csv: Download,
    xlsx: FileSpreadsheet,
  };
  const formatLabels: Record<ExportFormat, string> = { pdf: 'PDF', csv: 'CSV', xlsx: 'XLSX' };

  return (
    <div className="flex flex-col rounded-lg border border-border p-4 hover:border-primary/30 transition-all">
      <div className="flex items-start gap-3 mb-3">
        <FileText className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{description}</div>
        </div>
      </div>
      {recordCount !== undefined && (
        <div className="text-xs text-muted-foreground mb-3">
          {recordCount} {recordCount === 1 ? 'record' : 'records'}
        </div>
      )}
      <div className="flex items-center gap-1.5 mt-auto flex-wrap">
        <Button variant="outline" size="sm" onClick={onPreview}>
          <Eye className="h-3.5 w-3.5 mr-1.5" />
          View
        </Button>
        {formats.map((fmt) => {
          const Icon = formatIcons[fmt];
          const key = `${reportKey}-${fmt}`;
          return (
            <Button key={fmt} variant="ghost" size="sm" onClick={() => onExport(fmt)} disabled={exporting.has(key)} title={`Export ${formatLabels[fmt]}`}>
              {exporting.has(key) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
            </Button>
          );
        })}
        {onNarrative && (
          <Button variant="ghost" size="sm" onClick={onNarrative} title="Generate AI Narrative">
            <Sparkles className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function CampaignBadge({ status }: { status: string }) {
  const config: Record<string, { dot: string; cls: string }> = {
    'Not Started': { dot: 'bg-slate-400', cls: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700' },
    'Needs Review': { dot: 'bg-amber-500', cls: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' },
    'Ready to Invite': { dot: 'bg-cyan-500', cls: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800' },
    'Invitations Ready': { dot: 'bg-violet-500', cls: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800' },
    'Completed': { dot: 'bg-emerald-500', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' },
  };
  const c = config[status] || config['Not Started'];
  return (
    <Badge className={cn('text-[10px]', c.cls)}>
      <span className={cn('h-1.5 w-1.5 rounded-full mr-1.5', c.dot)} />
      {status}
    </Badge>
  );
}

const ACTION_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  import: { icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  generate_intelligence: { icon: Brain, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  score: { icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  create_event: { icon: Calendar, color: 'text-primary', bg: 'bg-primary/10' },
  generate_invite: { icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  send_invite: { icon: Mail, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  approve_attendee: { icon: CheckCircle2, color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
  reject_attendee: { icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20' },
  remove_attendee: { icon: Users, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20' },
  add_executive: { icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
};

function ActivityRow({ entry }: { entry: ActivityLogEntry }) {
  const config = ACTION_CONFIG[entry.action_type] || { icon: Activity, color: 'text-muted-foreground', bg: 'bg-muted' };
  const Icon = config.icon;
  const time = new Date(entry.timestamp);

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/20 transition-colors">
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0', config.bg)}>
        <Icon className={cn('h-4 w-4', config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{entry.description || entry.action_type}</span>
          {entry.send_mode && (
            <Badge className={entry.send_mode === 'test'
              ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 text-[10px]'
              : 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 text-[10px]'}>
              {entry.send_mode === 'test' ? <><TestTube className="h-2.5 w-2.5 mr-1" />TEST</> : <><Send className="h-2.5 w-2.5 mr-1" />LIVE</>}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">{time.toLocaleString()}</span>
          {entry.status && (
            <span className="flex items-center gap-1 text-xs">
              {entry.status === 'success' ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <AlertCircle className="h-3 w-3 text-rose-500" />}
              <span className="text-muted-foreground capitalize">{entry.status}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Event Report Preview ──

function EventReportPreview({ detail, onExport, exporting }: {
  detail: EventReportDetail;
  onExport: (fmt: ExportFormat) => void;
  exporting: Set<string>;
}) {
  const { event, intel, recommendations, activity } = detail;

  return (
    <div className="mt-4 space-y-5">
      {/* Summary */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Audience Overview</h3>
        <div className="grid grid-cols-2 gap-2">
          <SummaryStat label="Executives Analyzed" value={intel.totalAnalyzed} />
          <SummaryStat label="High-Fit" value={intel.highFit} valueClass="text-emerald-600 dark:text-emerald-400" />
          <SummaryStat label="Medium-Fit" value={intel.mediumFit} valueClass="text-blue-600 dark:text-blue-400" />
          <SummaryStat label="Low-Fit" value={intel.lowFit} valueClass="text-amber-600 dark:text-amber-400" />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Match Quality</h3>
        <SummaryStat label="Average Match Score" value={intel.averageScore !== null ? `${intel.averageScore}/100` : 'N/A'} />
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Campaign Progress</h3>
        <div className="grid grid-cols-2 gap-2">
          <SummaryStat label="Approved" value={intel.approvedCount} valueClass="text-cyan-600 dark:text-cyan-400" />
          <SummaryStat label="Pending Review" value={intel.pendingReview} valueClass="text-amber-600 dark:text-amber-400" />
          <SummaryStat label="Rejected" value={intel.rejectedCount} valueClass="text-rose-600 dark:text-rose-400" />
          <SummaryStat label="Invitation Drafts" value={intel.invitationCount} valueClass="text-violet-600 dark:text-violet-400" />
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold mb-3">Recommendations ({recommendations.length})</h3>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto max-h-[40vh] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="text-xs whitespace-nowrap">Executive</TableHead>
                    <TableHead className="text-xs whitespace-nowrap hidden md:table-cell">Company</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Score</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Tier</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recommendations.map((r) => (
                    <TableRow key={`${r.contact_id}-${r.event_id}`}>
                      <TableCell className="text-xs font-medium">{r.contact_name}</TableCell>
                      <TableCell className="text-xs hidden md:table-cell">{r.company}</TableCell>
                      <TableCell className="text-xs font-medium">{r.total_score}</TableCell>
                      <TableCell className="text-xs">{r.match_tier}</TableCell>
                      <TableCell className="text-xs">{r.recommendation_status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <h3 className="text-sm font-semibold mb-3">Recommendations</h3>
          <p className="text-sm text-muted-foreground">No recommendations generated for this event yet.</p>
        </div>
      )}

      {/* Invitation Activity */}
      {activity.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Invitation Activity ({activity.length})</h3>
          <div className="space-y-1.5">
            {activity.slice(0, 10).map((a) => (
              <ActivityRow key={a.id} entry={a} />
            ))}
          </div>
        </div>
      )}

      {/* Export */}
      <div className="pt-4 border-t border-border flex gap-2">
        <Button size="sm" onClick={() => onExport('pdf')} disabled={exporting.has(`event-${event.id}-pdf`)}>
          {exporting.has(`event-${event.id}-pdf`) ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileType className="h-3.5 w-3.5 mr-1.5" />}
          Export PDF
        </Button>
        <Button size="sm" variant="outline" onClick={() => onExport('csv')} disabled={exporting.has(`event-${event.id}-csv`)}>
          {exporting.has(`event-${event.id}-csv`) ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
          Export CSV
        </Button>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, valueClass }: { label: string; value: string | number; valueClass?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className={cn('text-lg font-bold tabular-nums', valueClass)}>{value}</div>
    </div>
  );
}

// ── Standard Report Preview ──

function StandardReportPreview({ reportKey, onExport, exporting, onNarrative }: {
  reportKey: ReportKey;
  onExport: (fmt: ExportFormat) => void;
  exporting: Set<string>;
  onNarrative: () => void;
}) {
  const [data, setData] = useState<ExecutiveReportRow[] | RecommendationReportRow[] | DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (reportKey === 'executive' || reportKey === 'spreadsheet') {
          const rows = await fetchExecutiveReportData();
          if (!cancelled) setData(rows);
        } else if (reportKey === 'recommendations') {
          const rows = await fetchRecommendationReportData();
          if (!cancelled) setData(rows);
        } else if (reportKey === 'dashboard') {
          const summary = await fetchDashboardSummary();
          if (!cancelled) setData(summary);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load report.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reportKey]);

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 text-primary animate-spin" /></div>;
  }
  if (error) {
    return <div className="py-8"><div className="flex items-center gap-2 text-destructive mb-4"><AlertCircle className="h-5 w-5" /><p className="text-sm font-medium">{error}</p></div></div>;
  }

  const config = REPORT_EXPORT_CONFIG[reportKey];

  if (reportKey === 'dashboard' && data) {
    const summary = data as DashboardSummary;
    return (
      <div className="mt-4 space-y-5">
        <div>
          <h3 className="text-sm font-semibold mb-3">Key Metrics</h3>
          <div className="grid grid-cols-2 gap-2">
            <SummaryStat label="Executives Analyzed" value={summary.kpis.executivesAnalyzed} />
            <SummaryStat label="High-Fit Matches" value={summary.kpis.highFitMatches} valueClass="text-emerald-600 dark:text-emerald-400" />
            <SummaryStat label="Approved Attendees" value={summary.kpis.approvedAttendees} valueClass="text-cyan-600 dark:text-cyan-400" />
            <SummaryStat label="Invitation Drafts" value={summary.kpis.invitationDrafts} valueClass="text-violet-600 dark:text-violet-400" />
            <SummaryStat label="Industries Represented" value={summary.industriesRepresented} />
            <SummaryStat label="Average Match Score" value={summary.averageMatchScore !== null ? `${summary.averageMatchScore}/100` : 'N/A'} />
          </div>
        </div>
        {summary.personaDistribution.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3">Persona Distribution</h3>
            <div className="space-y-1">
              {summary.personaDistribution.map((p) => (
                <div key={p.persona_type} className="flex items-center justify-between text-sm">
                  <span>{p.persona_type}</span>
                  <span className="font-medium tabular-nums">{p.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {summary.confidenceDistribution.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3">Confidence Distribution</h3>
            <div className="space-y-1">
              {summary.confidenceDistribution.map((c) => (
                <div key={c.level} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{c.level}</span>
                  <span className="font-medium tabular-nums">{c.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <ExportBar config={config} reportKey={reportKey} onExport={onExport} exporting={exporting} onNarrative={onNarrative} />
      </div>
    );
  }

  const rows = (data as unknown as Record<string, unknown>[]) || [];

  if (rows.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState icon={FileText} title="No data available" description="There is no data for this report yet." />
        <ExportBar config={config} reportKey={reportKey} onExport={onExport} exporting={exporting} onNarrative={onNarrative} />
      </div>
    );
  }

  const columns = Object.keys(rows[0]).map((key) => ({ key, label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }));

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">{rows.length} {rows.length === 1 ? 'row' : 'rows'}</Badge>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.key} className="text-xs whitespace-nowrap">{col.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className="text-xs whitespace-nowrap max-w-xs truncate" title={String(row[col.key] ?? '')}>
                      {String(row[col.key] ?? '')}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <ExportBar config={config} reportKey={reportKey} onExport={onExport} exporting={exporting} onNarrative={onNarrative} />
    </div>
  );
}

function ExportBar({ config, reportKey, onExport, exporting, onNarrative }: {
  config: ReportExportConfig;
  reportKey: string;
  onExport: (fmt: ExportFormat) => void;
  exporting: Set<string>;
  onNarrative: () => void;
}) {
  const formatIcons: Record<ExportFormat, React.ElementType> = {
    pdf: FileType, csv: Download, xlsx: FileSpreadsheet,
  };
  const formatLabels: Record<ExportFormat, string> = { pdf: 'PDF', csv: 'CSV', xlsx: 'XLSX' };

  return (
    <div className="pt-4 border-t border-border flex items-center gap-2 flex-wrap">
      {config.formats.map((fmt) => {
        const Icon = formatIcons[fmt];
        const key = `${reportKey}-${fmt}`;
        return (
          <Button key={fmt} size="sm" variant={fmt === config.formats[0] ? 'default' : 'outline'} onClick={() => onExport(fmt)} disabled={exporting.has(key)}>
            {exporting.has(key) ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Icon className="h-3.5 w-3.5 mr-1.5" />}
            {formatLabels[fmt]}
          </Button>
        );
      })}
      <Button size="sm" variant="ghost" onClick={onNarrative}>
        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
        AI Narrative
      </Button>
    </div>
  );
}

// ── Activity History Dialog ──

function ActivityHistoryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sendModeFilter, setSendModeFilter] = useState('all');

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchActivityHistory({
        search,
        type: typeFilter,
        status: statusFilter,
        dateRange: dateFilter as 'today' | 'this_week' | 'this_month' | 'all',
        sendMode: sendModeFilter,
        limit: 200,
      });
      setActivity(data);
    } catch {
      toast.error('Failed to load activity history.');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, statusFilter, dateFilter, sendModeFilter]);

  useEffect(() => {
    if (open) fetchActivity();
  }, [open, fetchActivity]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Activity History</DialogTitle>
          <DialogDescription>Full activity log with search and filters. Test sends are clearly distinguished from live sends.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search activity..." className="pl-9 h-8 text-sm" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[130px] h-8 text-sm"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="generate_intelligence">Intelligence</SelectItem>
              <SelectItem value="score">Recommendation</SelectItem>
              <SelectItem value="approve_attendee">Approval</SelectItem>
              <SelectItem value="generate_invite">Invitation</SelectItem>
              <SelectItem value="send_invite">Send</SelectItem>
              <SelectItem value="create_event">Event</SelectItem>
              <SelectItem value="import">Import</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[110px] h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[120px] h-8 text-sm"><SelectValue placeholder="Date" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sendModeFilter} onValueChange={setSendModeFilter}>
            <SelectTrigger className="w-[110px] h-8 text-sm"><SelectValue placeholder="Mode" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modes</SelectItem>
              <SelectItem value="test">Test Only</SelectItem>
              <SelectItem value="live">Live Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 text-primary animate-spin" /></div>
        ) : activity.length === 0 ? (
          <EmptyState icon={Activity} title="No activity found" description="Try adjusting your filters or search." />
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {activity.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
