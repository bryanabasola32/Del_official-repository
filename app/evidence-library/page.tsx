'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Database, Search, Upload, Archive, Eye, ChevronRight,
  User, Building2, CheckCircle2, X, Loader2, FileJson, Plus,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import type { Contact } from '@/lib/types';
import { ImportEvidenceDialog } from '@/components/ImportEvidenceDialog';

interface LibraryItem {
  id: string;
  contact_id: string;
  version: number;
  status: 'draft' | 'active' | 'archived';
  evidence_trust_score: number;
  evidence_completeness: number;
  source_count: number;
  fact_count: number;
  provider: string;
  imported_at: string;
  updated_at: string;
  notes: string | null;
}

interface EnrichedItem extends LibraryItem {
  contact?: Contact;
}

export default function EvidenceLibraryPage() {
  const [items, setItems] = useState<EnrichedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EnrichedItem | null>(null);
  const [archiving, setArchiving] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('executive_evidence_library')
        .select('*')
        .order('imported_at', { ascending: false });

      if (error) {
        toast.error('Failed to load evidence library: ' + error.message);
        setItems([]);
        return;
      }

      const rows = (data || []) as LibraryItem[];
      const contactIds = [...new Set(rows.map((r) => r.contact_id))];

      let contactMap: Map<string, Contact> = new Map();
      if (contactIds.length > 0) {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('*')
          .in('id', contactIds);
        if (contacts) {
          contactMap = new Map(contacts.map((c) => [c.id, c as Contact]));
        }
      }

      const enriched = rows.map((r) => ({
        ...r,
        contact: contactMap.get(r.contact_id),
      }));
      setItems(enriched);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleArchive = async (item: EnrichedItem) => {
    setArchiving(true);
    try {
      const { error } = await supabase
        .from('executive_evidence_library')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', item.id);

      if (error) {
        toast.error('Archive failed: ' + error.message);
      } else {
        toast.success(`Archived v${item.version} for ${item.contact?.name || 'executive'}`);
        await loadItems();
      }
    } finally {
      setArchiving(false);
    }
  };

  const filtered = searchQuery.trim()
    ? items.filter((item) => {
        const q = searchQuery.toLowerCase();
        const name = item.contact?.name?.toLowerCase() || '';
        const company = item.contact?.company?.toLowerCase() || '';
        return name.includes(q) || company.includes(q);
      })
    : items;

  const activeItems = filtered.filter((i) => i.status === 'active');
  const archivedItems = filtered.filter((i) => i.status === 'archived');

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Database className="h-5 w-5 text-muted-foreground" />
              Evidence Library
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Curated evidence packages used as enrichment fallback
            </p>
          </div>
          <Button onClick={() => setImportOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Import Evidence Package
          </Button>
        </div>
        <div className="px-6 pb-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search executive name or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : activeItems.length === 0 && archivedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <Database className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-medium">No curated evidence available</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              DEL will rely on live research. Import a curated evidence package to
              enable enrichment fallback for executives with weak live evidence.
            </p>
            <Button className="mt-4" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import Evidence Package
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {activeItems.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-muted-foreground mb-3">
                  Active Packages ({activeItems.length})
                </h2>
                <div className="grid gap-3">
                  {activeItems.map((item) => (
                    <LibraryCard
                      key={item.id}
                      item={item}
                      onView={() => setSelectedItem(item)}
                      onArchive={() => handleArchive(item)}
                      archiving={archiving}
                    />
                  ))}
                </div>
              </div>
            )}

            {archivedItems.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-muted-foreground mb-3">
                  Archived Versions ({archivedItems.length})
                </h2>
                <div className="grid gap-3 opacity-60">
                  {archivedItems.map((item) => (
                    <LibraryCard
                      key={item.id}
                      item={item}
                      onView={() => setSelectedItem(item)}
                      onArchive={null}
                      archiving={false}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ImportEvidenceDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={loadItems}
      />

      {selectedItem && (
        <EvidenceDetailDialog
          item={selectedItem}
          open={!!selectedItem}
          onOpenChange={(v) => { if (!v) setSelectedItem(null); }}
        />
      )}
    </div>
  );
}

function LibraryCard({
  item, onView, onArchive, archiving,
}: {
  item: EnrichedItem;
  onView: () => void;
  onArchive: (() => void) | null;
  archiving: boolean;
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border p-4 hover:border-primary/30 transition-colors">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted shrink-0">
        <FileJson className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">
            {item.contact?.name || 'Unknown Executive'}
          </p>
          <Badge variant="outline" className="text-xs">v{item.version}</Badge>
          {item.status === 'active' && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 text-xs">
              Active
            </Badge>
          )}
          {item.status === 'archived' && (
            <Badge variant="secondary" className="text-xs">Archived</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {item.contact?.company || '—'}
          {item.contact?.title ? ` · ${item.contact.title}` : ''}
        </p>
        <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
          <span>{item.source_count} sources</span>
          <span>{item.fact_count} facts</span>
          <span>Trust: {item.evidence_trust_score}%</span>
          <span>Imported: {new Date(item.imported_at).toLocaleDateString()}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="sm" onClick={onView}>
          <Eye className="h-4 w-4" />
        </Button>
        {onArchive && (
          <Button variant="ghost" size="sm" onClick={onArchive} disabled={archiving}>
            <Archive className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function EvidenceDetailDialog({
  item, open, onOpenChange,
}: {
  item: EnrichedItem;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [packageData, setPackageData] = useState<{ sources: unknown[]; facts: unknown[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      setLoading(true);
      supabase
        .from('executive_evidence_library')
        .select('evidence_package')
        .eq('id', item.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.evidence_package) {
            const pkg = data.evidence_package as { sources?: unknown[]; facts?: unknown[] };
            setPackageData({
              sources: pkg.sources || [],
              facts: pkg.facts || [],
            });
          }
          setLoading(false);
        });
    }
  }, [open, item.id]);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${open ? '' : 'hidden'}`}>
      <div className="absolute inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="relative bg-background rounded-xl border border-border shadow-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto scrollbar-thin p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">
              {item.contact?.name || 'Unknown Executive'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {item.contact?.company} · v{item.version} · {item.status}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg border border-border p-3 text-center">
            <div className="text-2xl font-bold">{item.source_count}</div>
            <div className="text-xs text-muted-foreground">Sources</div>
          </div>
          <div className="rounded-lg border border-border p-3 text-center">
            <div className="text-2xl font-bold">{item.fact_count}</div>
            <div className="text-xs text-muted-foreground">Facts</div>
          </div>
          <div className="rounded-lg border border-border p-3 text-center">
            <div className="text-2xl font-bold">{item.evidence_trust_score}%</div>
            <div className="text-xs text-muted-foreground">Trust</div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : packageData ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Sources ({packageData.sources.length})</h3>
              <div className="max-h-40 overflow-y-auto scrollbar-thin space-y-1">
                {(packageData.sources as Array<{ url?: string; sourceName?: string; title?: string }>).map((src, i) => (
                  <div key={i} className="text-xs text-muted-foreground truncate">
                    {src.sourceName || src.title || src.url || `Source ${i + 1}`}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">Facts ({packageData.facts.length})</h3>
              <div className="max-h-40 overflow-y-auto scrollbar-thin space-y-1">
                {(packageData.facts as Array<{ subject?: string; predicate?: string; value?: string; factId?: string }>).map((fact, i) => (
                  <div key={i} className="text-xs text-muted-foreground">
                    <span className="font-medium">{fact.predicate || 'fact'}:</span> {fact.value || '—'}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Unable to load package data</p>
        )}

        {item.contact && (
          <div className="mt-4 pt-4 border-t border-border">
            <Link
              href={`/executives/${item.contact.id}`}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              View Executive Profile <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
