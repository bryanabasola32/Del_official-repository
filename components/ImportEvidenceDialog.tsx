'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Upload, FileJson, CheckCircle2, AlertTriangle, X, Search,
  Database, ChevronRight, Loader2, User, Building2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { Contact } from '@/lib/types';
import type { RawCuratedPackage, ValidationResult, IdentityMatchResult } from '@/services/evidence/CuratedEvidenceTypes';
import { getCuratedEvidenceLibrary } from '@/services/evidence/CuratedEvidenceLibrary';
import type { EvidencePackage } from '@/services/research/EvidencePackage';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedContactId?: string;
  onImported?: () => void;
}

type Step = 'select' | 'input' | 'validate' | 'preview' | 'saving' | 'done';

export function ImportEvidenceDialog({ open, onOpenChange, preselectedContactId, onImported }: Props) {
  const [step, setStep] = useState<Step>('select');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [fileName, setFileName] = useState('');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [identityMatch, setIdentityMatch] = useState<IdentityMatchResult | null>(null);
  const [previewPackage, setPreviewPackage] = useState<EvidencePackage | null>(null);
  const [saveError, setSaveError] = useState('');
  const [savedVersion, setSavedVersion] = useState(0);

  useEffect(() => {
    if (open) {
      loadContacts();
      if (preselectedContactId) {
        setStep('input');
      } else {
        setStep('select');
      }
    }
  }, [open, preselectedContactId]);

  const loadContacts = async () => {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('name', { ascending: true });
    if (error) {
      toast.error('Failed to load executives: ' + error.message);
      return;
    }
    const list = (data || []) as Contact[];
    setContacts(list);
    setFilteredContacts(list);
    if (preselectedContactId) {
      const pre = list.find((c) => c.id === preselectedContactId);
      if (pre) setSelectedContact(pre);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredContacts(contacts);
      return;
    }
    const q = query.toLowerCase();
    setFilteredContacts(contacts.filter((c) =>
      c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q),
    ));
  };

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact);
    setStep('input');
  };

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    try {
      const text = await file.text();
      setJsonInput(text);
      runValidation(text);
    } catch {
      toast.error('Unable to read file');
    }
  }, []);

  const runValidation = (jsonText: string) => {
    setStep('validate');
    setValidation(null);
    setIdentityMatch(null);
    setPreviewPackage(null);

    try {
      const parsed = JSON.parse(jsonText) as RawCuratedPackage;
      const library = getCuratedEvidenceLibrary();
      const valResult = library.validatePackage(parsed);
      setValidation(valResult);

      if (!valResult.valid) {
        setStep('preview');
        return;
      }

      if (!selectedContact) {
        setStep('preview');
        return;
      }

      const idResult = library.validateIdentity(parsed, selectedContact);
      setIdentityMatch(idResult);

      if (idResult.matched) {
        const preview = library.previewPackage(parsed, selectedContact);
        setPreviewPackage(preview);
      }

      setStep('preview');
    } catch (err) {
      setValidation({
        valid: false,
        errors: [err instanceof Error ? err.message : 'Invalid JSON'],
        warnings: [],
        identity: { name: '', company: '', title: '' },
        sourceCount: 0,
        factCount: 0,
      });
      setStep('preview');
    }
  };

  const handleConfirmSave = async () => {
    if (!selectedContact || !validation?.valid) return;

    setStep('saving');
    setSaveError('');

    try {
      const parsed = JSON.parse(jsonInput) as RawCuratedPackage;
      const library = getCuratedEvidenceLibrary();
      const result = await library.savePackage(
        selectedContact.id,
        parsed,
        selectedContact,
      );

      if (result.success) {
        setSavedVersion(result.version);
        setStep('done');
        toast.success(`Evidence package v${result.version} saved for ${selectedContact.name}`);
        onImported?.();
      } else {
        setSaveError(result.errors.join('; '));
        setStep('preview');
        toast.error('Import failed: ' + result.errors.join('; '));
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unknown error');
      setStep('preview');
      toast.error('Import failed');
    }
  };

  const reset = () => {
    setStep('select');
    setSelectedContact(null);
    setJsonInput('');
    setFileName('');
    setValidation(null);
    setIdentityMatch(null);
    setPreviewPackage(null);
    setSaveError('');
    setSavedVersion(0);
  };

  const importable = validation?.valid && identityMatch?.matched;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setTimeout(reset, 300); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-thin">
        {step === 'select' && (
          <>
            <DialogHeader>
              <DialogTitle>Import Evidence Package</DialogTitle>
              <DialogDescription>
                Select the executive this curated evidence package belongs to.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search executive name or company..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="max-h-80 overflow-y-auto scrollbar-thin rounded-lg border border-border">
                {filteredContacts.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No executives found
                  </div>
                ) : (
                  filteredContacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => handleSelectContact(contact)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left border-b border-border last:border-0"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{contact.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {contact.title || '—'} · {contact.company}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {step === 'input' && (
          <>
            <DialogHeader>
              <DialogTitle>Upload Evidence Package</DialogTitle>
              <DialogDescription>
                {selectedContact && (
                  <>For: <span className="font-medium text-foreground">{selectedContact.name}</span> ({selectedContact.company})</>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {selectedContact && (
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="gap-1">
                    <User className="h-3 w-3" />
                    {selectedContact.name}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Building2 className="h-3 w-3" />
                    {selectedContact.company}
                  </Badge>
                  <button
                    onClick={() => { setSelectedContact(null); setStep('select'); }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Change
                  </button>
                </div>
              )}

              <div
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => document.getElementById('evidence-file')?.click()}
              >
                <FileJson className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Click to upload JSON file</p>
                <p className="text-xs text-muted-foreground mt-1">Curated evidence package (.json)</p>
                <input
                  id="evidence-file"
                  type="file"
                  accept=".json,.txt"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or paste JSON</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="json-input">Evidence Package JSON</Label>
                <Textarea
                  id="json-input"
                  placeholder='{"executive": {"name": "...", "company": "..."}, "sources": [...], "facts": [...]}'
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  className="min-h-[120px] font-mono text-xs scrollbar-thin"
                />
              </div>

              {fileName && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileJson className="h-4 w-4" />
                  {fileName}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('select')}>Back</Button>
              <Button
                onClick={() => runValidation(jsonInput)}
                disabled={!jsonInput.trim()}
              >
                Validate & Preview
              </Button>
            </DialogFooter>
          </>
        )}

        {(step === 'validate' || step === 'preview' || step === 'saving') && (
          <>
            <DialogHeader>
              <DialogTitle>Validation Result</DialogTitle>
              <DialogDescription>
                {selectedContact && (
                  <>For: {selectedContact.name} ({selectedContact.company})</>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {step === 'validate' && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Validating...</span>
                </div>
              )}

              {step === 'preview' && validation && (
                <>
                  <div className={`rounded-lg border p-4 ${validation.valid ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20' : 'border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {validation.valid ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <X className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                      )}
                      <span className="font-medium text-sm">
                        {validation.valid ? 'Schema Valid' : 'Schema Invalid'}
                      </span>
                    </div>
                    {validation.errors.length > 0 && (
                      <ul className="text-xs text-rose-700 dark:text-rose-400 space-y-1 ml-7">
                        {validation.errors.map((err, i) => <li key={i}>• {err}</li>)}
                      </ul>
                    )}
                    {validation.warnings.length > 0 && (
                      <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 ml-7 mt-1">
                        {validation.warnings.map((w, i) => <li key={i}>• {w}</li>)}
                      </ul>
                    )}
                  </div>

                  {validation.valid && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-border p-3">
                        <div className="text-xs text-muted-foreground">Executive</div>
                        <div className="text-sm font-medium">{validation.identity.name}</div>
                        <div className="text-xs text-muted-foreground">{validation.identity.company}</div>
                        {validation.identity.title && (
                          <div className="text-xs text-muted-foreground">{validation.identity.title}</div>
                        )}
                      </div>
                      <div className="rounded-lg border border-border p-3">
                        <div className="text-xs text-muted-foreground">Package Size</div>
                        <div className="text-sm font-medium">{validation.sourceCount} sources, {validation.factCount} facts</div>
                      </div>
                    </div>
                  )}

                  {validation.valid && identityMatch && (
                    <div className={`rounded-lg border p-4 ${identityMatch.matched ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20' : 'border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        {identityMatch.matched ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                        )}
                        <span className="font-medium text-sm">
                          Identity {identityMatch.matched ? 'Matched' : 'Mismatch'} (confidence: {identityMatch.confidence})
                        </span>
                      </div>
                      {identityMatch.reasons.length > 0 && (
                        <ul className="text-xs text-rose-700 dark:text-rose-400 space-y-1 ml-7">
                          {identityMatch.reasons.map((r, i) => <li key={i}>• {r}</li>)}
                        </ul>
                      )}
                    </div>
                  )}

                  {validation.valid && identityMatch?.matched && previewPackage && (
                    <div className="rounded-lg border border-border p-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Database className="h-4 w-4 text-muted-foreground" />
                        Evidence Preview
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-muted-foreground">Sources: <span className="text-foreground font-medium">{previewPackage.sources.length}</span></div>
                        <div className="text-muted-foreground">Facts: <span className="text-foreground font-medium">{previewPackage.facts.length}</span></div>
                        <div className="text-muted-foreground">Conflicts: <span className="text-foreground font-medium">{previewPackage.conflicts.length}</span></div>
                        <div className="text-muted-foreground">Version: <span className="text-foreground font-medium">{(previewPackage.metadata as Record<string, unknown>).version as string || 'new'}</span></div>
                      </div>
                    </div>
                  )}

                  {saveError && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20 p-3 text-sm text-rose-700 dark:text-rose-400">
                      {saveError}
                    </div>
                  )}
                </>
              )}

              {step === 'saving' && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Saving to evidence library...</span>
                </div>
              )}
            </div>

            {step === 'preview' && (
              <DialogFooter>
                <Button variant="outline" onClick={() => setStep('input')}>Back</Button>
                <Button
                  onClick={handleConfirmSave}
                  disabled={!importable}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Save to Evidence Library
                </Button>
              </DialogFooter>
            )}
          </>
        )}

        {step === 'done' && (
          <>
            <DialogHeader>
              <DialogTitle>Import Complete</DialogTitle>
              <DialogDescription>
                Evidence package v{savedVersion} has been saved for {selectedContact?.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 flex flex-col items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-4">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                This package will be used as a fallback enrichment source
                when live research produces insufficient evidence for {selectedContact?.name}.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => { onOpenChange(false); setTimeout(reset, 300); }}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
