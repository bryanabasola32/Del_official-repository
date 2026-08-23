'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Users, Plus, MoreVertical, Mail, Phone, Building2, ChevronRight,
  Eye, Pencil, Trash2, Brain, ArrowUpDown, ArrowUp, ArrowDown, Filter,
  ChevronLeft, Loader2, Sparkles, CalendarCheck, Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/lib/supabase';
import type { Contact } from '@/lib/types';
import { AddExecutiveDialog } from '@/components/AddExecutiveDialog';
import { EditExecutiveDialog } from '@/components/EditExecutiveDialog';
import { ImportExecutivesDialog } from '@/components/ImportExecutivesDialog';
import { generateExecutiveIntelligence } from '@/services/orchestrator';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { IntelligenceStatusBadge, getIntelligenceState } from '@/components/ExecutiveIntelligenceBadge';

type SortField = 'name' | 'company' | 'title' | 'industry' | 'updated_at';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'all' | 'pending' | 'processing' | 'completed';
type PersonaFilter = 'all' | 'with' | 'without';

const PAGE_SIZE = 10;

interface ContactWithStats extends Contact {
  recommendation_count: number;
  assigned_count: number;
}

export default function ExecutivesPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<ContactWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [personaFilter, setPersonaFilter] = useState<PersonaFilter>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteContact, setDeleteContact] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const { data: contactData } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false });

    if (!contactData || contactData.length === 0) {
      setContacts([]);
      setLoading(false);
      return;
    }

    const contactIds = contactData.map((c) => c.id);

    const [scoresResult, recsResult] = await Promise.all([
      supabase
        .from('event_scores')
        .select('contact_id, is_final_attendee, recommendation_status')
        .in('contact_id', contactIds),
      supabase
        .from('intelligence_recommendations')
        .select('contact_id, status')
        .in('contact_id', contactIds),
    ]);

    const assignedMap = new Map<string, number>();
    for (const s of scoresResult.data || []) {
      if (s.is_final_attendee) {
        assignedMap.set(s.contact_id, (assignedMap.get(s.contact_id) || 0) + 1);
      }
    }

    const recMap = new Map<string, number>();
    for (const r of recsResult.data || []) {
      if (r.status === 'pending' || r.status === 'approved') {
        recMap.set(r.contact_id, (recMap.get(r.contact_id) || 0) + 1);
      }
    }

    const enriched: ContactWithStats[] = contactData.map((c) => ({
      ...c,
      recommendation_count: recMap.get(c.id) || 0,
      assigned_count: assignedMap.get(c.id) || 0,
    }));

    setContacts(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const companies = useMemo(() => {
    const set = new Set(contacts.map((c) => c.company).filter(Boolean));
    return Array.from(set).sort();
  }, [contacts]);

  const industries = useMemo(() => {
    const set = new Set(contacts.map((c) => c.industry).filter((v): v is string => !!v));
    return Array.from(set).sort();
  }, [contacts]);

  const filtered = useMemo(() => {
    let result = contacts;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        (c.title || '').toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((c) => {
        const state = getIntelligenceState(c);
        if (statusFilter === 'completed') return state === 'ready' || state === 'assigned' || state === 'drafted' || state === 'needs_review';
        if (statusFilter === 'processing') return state === 'processing';
        if (statusFilter === 'pending') return state === 'not_started';
        return true;
      });
    }

    if (companyFilter !== 'all') {
      result = result.filter((c) => c.company === companyFilter);
    }

    if (industryFilter !== 'all') {
      result = result.filter((c) => c.industry === industryFilter);
    }

    if (personaFilter === 'with') {
      result = result.filter((c) => c.persona_provided && c.persona_provided.trim());
    } else if (personaFilter === 'without') {
      result = result.filter((c) => !c.persona_provided || !c.persona_provided.trim());
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'company') cmp = a.company.localeCompare(b.company);
      else if (sortField === 'title') cmp = (a.title || '').localeCompare(b.title || '');
      else if (sortField === 'industry') cmp = (a.industry || '').localeCompare(b.industry || '');
      else if (sortField === 'updated_at') cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [contacts, search, statusFilter, companyFilter, industryFilter, personaFilter, sortField, sortDir]);

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
      fetchContacts();
    } catch {
      toast.error(`Failed to generate intelligence for ${contact.name}`);
    } finally {
      setGenerating(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteContact) return;
    setDeleting(true);
    const { error } = await supabase.from('contacts').delete().eq('id', deleteContact.id);
    if (error) {
      toast.error('Failed to delete executive');
    } else {
      toast.success(`${deleteContact.name} deleted`);
      fetchContacts();
    }
    setDeleting(false);
    setDeleteContact(null);
  };

  const hasActiveFilters = search || statusFilter !== 'all' || companyFilter !== 'all' || industryFilter !== 'all' || personaFilter !== 'all';

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Executive List</h1>
          <p className="text-sm text-muted-foreground mt-1">Your executive intelligence workspace — manage AI analysis, recommendations, and event assignments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Users className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Executive
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, position, or company..."
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as StatusFilter); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Not Yet Analyzed</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Intelligence Generated</SelectItem>
            </SelectContent>
          </Select>
          <Select value={companyFilter} onValueChange={(v) => { setCompanyFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Company" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {companies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={industryFilter} onValueChange={(v) => { setIndustryFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Industry" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Industries</SelectItem>
              {industries.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={personaFilter} onValueChange={(v) => { setPersonaFilter(v as PersonaFilter); setPage(1); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Persona" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Persona</SelectItem>
              <SelectItem value="with">With Persona</SelectItem>
              <SelectItem value="without">No Persona</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border sticky top-0">
              <tr>
                <SortableHeader label="Executive Name" field="name" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Company" field="company" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Position" field="title" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Contact</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Intelligence Status</th>
                <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                  <div className="flex items-center justify-center gap-1">
                    <Target className="h-3.5 w-3.5" />
                    Recs
                  </div>
                </th>
                <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                  <div className="flex items-center justify-center gap-1">
                    <CalendarCheck className="h-3.5 w-3.5" />
                    Assigned
                  </div>
                </th>
                <SortableHeader label="Last Updated" field="updated_at" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="hidden xl:table-cell" />
                <th className="p-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="p-6"><TableSkeleton rows={8} cols={8} /></td></tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    {hasActiveFilters ? (
                      <EmptyState
                        icon={Filter}
                        title="No matching executives"
                        description="Try adjusting your search or filters to find what you're looking for."
                      />
                    ) : (
                      <EmptyState
                        icon={Users}
                        title="No executives have been added"
                        description="Import a spreadsheet roster or add executives one by one to get started."
                        action={{ label: 'Import Executives', onClick: () => setImportOpen(true) }}
                      />
                    )}
                  </td>
                </tr>
              ) : paged.map((contact) => {
                const state = getIntelligenceState(contact);
                return (
                  <tr
                    key={contact.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => router.push(`/executives/${contact.id}`)}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">
                          {contact.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{contact.name}</div>
                          {contact.executive_summary && (
                            <div className="text-xs text-muted-foreground/70 truncate max-w-[200px]">{contact.executive_summary}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 text-sm">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {contact.company}
                      </div>
                      {contact.industry && (
                        <div className="text-xs text-muted-foreground/60 ml-5 mt-0.5">{contact.industry}</div>
                      )}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">{contact.title || <span className="text-muted-foreground/50">Title not provided</span>}</td>
                    <td className="p-3 hidden md:table-cell">
                      <div className="space-y-0.5">
                        {contact.email ? (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" /> {contact.email}
                          </div>
                        ) : null}
                        {contact.phone ? (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" /> {contact.phone}
                          </div>
                        ) : null}
                        {!contact.email && !contact.phone && <span className="text-xs text-muted-foreground/50">No contact on file</span>}
                      </div>
                    </td>
                    <td className="p-3">
                      <IntelligenceStatusBadge state={state} />
                      {state === 'ready' && contact.persona_confidence_pct != null && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Confidence: <span className={cn(
                            'font-medium',
                            contact.persona_confidence_level === 'high' ? 'text-emerald-600 dark:text-emerald-400' :
                            contact.persona_confidence_level === 'medium' ? 'text-amber-600 dark:text-amber-400' :
                            'text-rose-600 dark:text-rose-400'
                          )}>{contact.persona_confidence_pct}%</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3 hidden lg:table-cell text-center">
                      {contact.recommendation_count > 0 ? (
                        <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
                          {contact.recommendation_count}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="p-3 hidden lg:table-cell text-center">
                      {contact.assigned_count > 0 ? (
                        <Badge className="bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800">
                          {contact.assigned_count}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="p-3 hidden xl:table-cell text-xs text-muted-foreground">
                      {contact.updated_at ? new Date(contact.updated_at).toLocaleDateString() : <span className="text-muted-foreground/50">Not yet analyzed</span>}
                    </td>
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {state === 'not_started' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleGenerate(contact)}
                            disabled={generating === contact.id}
                          >
                            {generating === contact.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Brain className="h-3.5 w-3.5 mr-1" />}
                            Analyze
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/executives/${contact.id}`)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEditContact(contact); setEditOpen(true); }}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleGenerate(contact)}
                              disabled={generating === contact.id}
                            >
                              {generating === contact.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                              {generating === contact.id ? 'Analyzing...' : state === 'not_started' ? 'Analyze' : 'Re-analyze'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteContact(contact)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <AddExecutiveDialog open={addOpen} onOpenChange={setAddOpen} />
      <ImportExecutivesDialog open={importOpen} onOpenChange={setImportOpen} />
      <EditExecutiveDialog open={editOpen} onOpenChange={setEditOpen} contact={editContact} onSaved={fetchContacts} />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteContact} onOpenChange={(v) => !v && setDeleteContact(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Executive</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteContact?.name}? This will also remove all associated intelligence and scores. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortableHeader({ label, field, sortField, sortDir, onSort, className }: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const isActive = sortField === field;
  return (
    <th className={cn('text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider', className)}>
      <button
        onClick={() => onSort(field)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {label}
        {isActive ? (
          sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );
}
