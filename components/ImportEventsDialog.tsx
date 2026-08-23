'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  FileSpreadsheet, CheckCircle2, AlertTriangle, X, Upload, ArrowRight,
  ArrowLeft, Layers, Table, AlertCircle, Building2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  parseSpreadsheet, type ParsedSpreadsheet, type ParsedWorksheet,
} from '@/lib/spreadsheetParser';
import {
  detectColumns, getFieldLabel, type ColumnDetectionResult, type EventFieldName,
} from '@/lib/columnDetector';
import {
  extractEvents, type ExtractionResult, type ExtractedEvent, type ValidationSummary,
} from '@/lib/eventExtractor';

type Step = 'upload' | 'analyzing' | 'analysis' | 'preview' | 'importing' | 'done' | 'error';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

export function ImportEventsDialog({ open, onOpenChange, onImported }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedSpreadsheet | null>(null);
  const [selectedSheetIdx, setSelectedSheetIdx] = useState(0);
  const [detection, setDetection] = useState<ColumnDetectionResult | null>(null);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const reset = useCallback(() => {
    setStep('upload');
    setFileName('');
    setParsed(null);
    setSelectedSheetIdx(0);
    setDetection(null);
    setExtraction(null);
    setErrorMsg('');
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setStep('analyzing');
    setErrorMsg('');

    try {
      const result = await parseSpreadsheet(file);
      setParsed(result);
      setSelectedSheetIdx(result.selectedSheetIndex);

      // Run column detection and event extraction on the auto-selected sheet
      const sheet = result.worksheets[result.selectedSheetIndex];
      const det = detectColumns(sheet);
      const ext = extractEvents(sheet, det);

      setDetection(det);
      setExtraction(ext);
      setStep('analysis');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to parse the spreadsheet.';
      setErrorMsg(msg);
      setStep('error');
    }
  }, []);

  const handleSheetChange = useCallback((idx: number) => {
    if (!parsed) return;
    setSelectedSheetIdx(idx);
    const sheet = parsed.worksheets[idx];
    const det = detectColumns(sheet);
    const ext = extractEvents(sheet, det);
    setDetection(det);
    setExtraction(ext);
  }, [parsed]);

  const handleProceedToPreview = useCallback(() => {
    setStep('preview');
  }, []);

  const handleImport = useCallback(async () => {
    if (!extraction) return;
    setStep('importing');

    const validEvents = extraction.events.filter((e) => e.status === 'valid');
    if (validEvents.length === 0) {
      toast.error('No valid events to import');
      setStep('preview');
      return;
    }

    const inserts = validEvents.map((e) => ({
      event_name: e.event_name,
      date: e.date || null,
      time: e.time || null,
      venue: e.venue || null,
      organizer: e.organizer || null,
      description: e.description || null,
      target_industries: e.industry ? e.industry.split(',').map((s) => s.trim()).filter(Boolean) : [],
      target_companies: e.target_companies.length > 0 ? e.target_companies : null,
      max_capacity: e.max_capacity || null,
      theme: e.theme || null,
      status: 'upcoming',
    }));

    const { error } = await supabase.from('events').insert(inserts);
    if (error) {
      toast.error('Import failed: ' + error.message);
      setStep('preview');
      return;
    }

    await supabase.from('activity_log').insert({
      action_type: 'import_events',
      status: 'success',
      description: `Imported ${validEvents.length} events from ${fileName}`,
    });

    toast.success(`Imported ${validEvents.length} events`);
    setStep('done');
    onImported?.();
  }, [extraction, fileName, onImported]);

  const summary = extraction?.summary;
  const validEvents = useMemo(
    () => extraction?.events.filter((e) => e.status === 'valid') ?? [],
    [extraction],
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setTimeout(reset, 300); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        {/* ── Upload Step ── */}
        {step === 'upload' && (
          <>
            <DialogHeader>
              <DialogTitle>Import Events</DialogTitle>
              <DialogDescription>
                Upload a spreadsheet with your event roster. I&apos;ll analyze the structure, map columns automatically, validate the data, and show you exactly what will be imported. Supported formats: CSV, XLS, XLSX.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => document.getElementById('import-events-file')?.click()}
              >
                <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Click to upload your spreadsheet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  No fixed template required — I&apos;ll detect columns automatically
                </p>
                <input
                  id="import-events-file"
                  type="file"
                  accept=".csv,.txt,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>
            </div>
          </>
        )}

        {/* ── Analyzing Step ── */}
        {step === 'analyzing' && (
          <div className="py-12 flex flex-col items-center">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mb-4" />
            <p className="text-sm font-medium">Analyzing spreadsheet...</p>
            <p className="text-xs text-muted-foreground mt-1">{fileName}</p>
          </div>
        )}

        {/* ── Error Step ── */}
        {step === 'error' && (
          <>
            <DialogHeader>
              <DialogTitle>Import Error</DialogTitle>
            </DialogHeader>
            <div className="py-6 flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/30 mb-4">
                <AlertCircle className="h-7 w-7 text-rose-600 dark:text-rose-400" />
              </div>
              <p className="text-sm font-medium mb-2">Unable to parse the spreadsheet</p>
              <p className="text-sm text-muted-foreground max-w-md">{errorMsg}</p>
              <p className="text-xs text-muted-foreground mt-3">
                Please verify the file format and ensure it contains event data with a header row.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={reset}>
                <Upload className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Analysis Step (Spreadsheet Analysis + Column Mapping + Validation) ── */}
        {step === 'analysis' && parsed && detection && summary && (
          <>
            <DialogHeader>
              <DialogTitle>Spreadsheet Analysis</DialogTitle>
              <DialogDescription>
                I&apos;ve analyzed your spreadsheet and mapped the columns automatically. Review the analysis below before proceeding.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-5">
              {/* File Info */}
              <div className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  {fileName}
                </div>

                {/* Worksheet selector */}
                {parsed.worksheets.length > 1 && (
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground min-w-fit">Worksheet:</span>
                    <Select value={String(selectedSheetIdx)} onValueChange={(v) => handleSheetChange(parseInt(v, 10))}>
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {parsed.worksheets.map((ws, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {ws.name} ({ws.rowCount} rows)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {parsed.worksheets.length === 1 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Layers className="h-3.5 w-3.5" />
                    Worksheet: {parsed.worksheets[0].name}
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Table className="h-3.5 w-3.5" />
                  Rows found: <span className="font-medium text-foreground">{summary.totalEvents}</span>
                </div>
              </div>

              {/* Columns Detected */}
              <div>
                <h4 className="text-sm font-medium mb-2">Columns Detected</h4>
                <div className="flex flex-wrap gap-1.5">
                  {detection.mappings.map((m, i) => (
                    <Badge key={i} variant="secondary" className="text-xs gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      {getFieldLabel(m.field)}
                    </Badge>
                  ))}
                  {detection.unmappedHeaders.map((h, i) => (
                    <Badge key={`unmapped-${i}`} variant="outline" className="text-xs text-muted-foreground">
                      {h} (unmapped)
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Column Mapping */}
              <div>
                <h4 className="text-sm font-medium mb-2">Column Mapping</h4>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 font-medium">Spreadsheet Column</th>
                        <th className="text-center p-2 font-medium w-8"></th>
                        <th className="text-left p-2 font-medium">DEL Event Model</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detection.mappings.map((m, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="p-2">{m.spreadsheetColumn}</td>
                          <td className="p-2 text-center">
                            <ArrowRight className="h-3 w-3 text-muted-foreground inline" />
                          </td>
                          <td className="p-2 font-medium">
                            {getFieldLabel(m.field)}
                            {m.required && <span className="text-rose-500 ml-1">*</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Validation Summary */}
              <div>
                <h4 className="text-sm font-medium mb-2">Import Summary</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <SummaryStat label="Events Found" value={summary.totalEvents} tone="neutral" />
                  <SummaryStat label="Duplicate IDs" value={summary.duplicateIds} tone={summary.duplicateIds > 0 ? 'warning' : 'good'} />
                  <SummaryStat label="Duplicate Names" value={summary.duplicateNames} tone={summary.duplicateNames > 0 ? 'warning' : 'good'} />
                  <SummaryStat label="Missing Names" value={summary.missingNames} tone={summary.missingNames > 0 ? 'error' : 'good'} />
                  <SummaryStat label="Invalid Dates" value={summary.invalidDates} tone={summary.invalidDates > 0 ? 'warning' : 'good'} />
                  <SummaryStat label="Invalid Times" value={summary.invalidTimes} tone={summary.invalidTimes > 0 ? 'warning' : 'good'} />
                  <SummaryStat label="Missing Descriptions" value={summary.missingDescriptions} tone={summary.missingDescriptions > 0 ? 'warning' : 'good'} />
                  <SummaryStat label="Missing Optional Fields" value={summary.missingOptionalFields} tone={summary.missingOptionalFields > 0 ? 'neutral' : 'good'} />
                </div>
                {summary.readyToImport ? (
                  <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-medium">Ready to Import — {summary.validEvents} valid event{summary.validEvents !== 1 ? 's' : ''}</span>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">No valid events to import — all rows have missing names or are duplicates</span>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={reset}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleProceedToPreview} disabled={!summary.readyToImport}>
                Preview Events
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Preview Step ── */}
        {step === 'preview' && extraction && summary && (
          <>
            <DialogHeader>
              <DialogTitle>Review Import — {fileName}</DialogTitle>
              <DialogDescription>
                These are the actual events from your spreadsheet. {summary.validEvents} of {summary.totalEvents} rows are valid and ready to import.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20 p-3 text-center">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{summary.validEvents}</div>
                  <div className="text-xs text-emerald-700 dark:text-emerald-500">Ready to Import</div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3 text-center">
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {summary.duplicateIds + summary.duplicateNames}
                  </div>
                  <div className="text-xs text-amber-700 dark:text-amber-500">Duplicates</div>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20 p-3 text-center">
                  <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{summary.missingNames}</div>
                  <div className="text-xs text-rose-700 dark:text-rose-500">Missing Name</div>
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto scrollbar-thin rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0 z-10">
                    <tr>
                      <th className="text-left p-2 font-medium text-xs">Event ID</th>
                      <th className="text-left p-2 font-medium text-xs">Event Name</th>
                      <th className="text-left p-2 font-medium text-xs hidden md:table-cell">Date</th>
                      <th className="text-left p-2 font-medium text-xs hidden lg:table-cell">Industry</th>
                      <th className="text-left p-2 font-medium text-xs">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extraction.events.map((evt, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="p-2 text-xs text-muted-foreground font-mono">
                          {evt.event_id || '—'}
                        </td>
                        <td className="p-2 font-medium">
                          {evt.event_name || <span className="text-rose-500">—</span>}
                          {evt.description && (
                            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {evt.description}
                            </div>
                          )}
                        </td>
                        <td className="p-2 text-xs text-muted-foreground hidden md:table-cell">
                          {evt.date ? formatDate(evt.date) : '—'}
                          {evt.time && <div className="text-xs">{evt.time}</div>}
                        </td>
                        <td className="p-2 text-xs text-muted-foreground hidden lg:table-cell">
                          {evt.industry || '—'}
                        </td>
                        <td className="p-2">
                          <StatusBadge status={evt.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {summary.missingOptionalFields > 0 && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    {summary.missingOptionalFields} event(s) have missing optional fields (venue, organizer).
                    These will be imported with &quot;Not Provided&quot; defaults — they won&apos;t be rejected.
                  </span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('analysis')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleImport} disabled={summary.validEvents === 0}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Import {summary.validEvents} Event{summary.validEvents !== 1 ? 's' : ''}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Importing Step ── */}
        {step === 'importing' && (
          <div className="py-12 flex flex-col items-center">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mb-4" />
            <p className="text-sm font-medium">Importing events...</p>
          </div>
        )}

        {/* ── Done Step ── */}
        {step === 'done' && summary && (
          <>
            <DialogHeader>
              <DialogTitle>Import Complete</DialogTitle>
              <DialogDescription>
                Successfully imported {summary.validEvents} events. They&apos;re now in your Event List.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 flex flex-col items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-4">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex gap-3 text-sm flex-wrap justify-center">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> {summary.validEvents} imported
                </div>
                {(summary.duplicateIds + summary.duplicateNames) > 0 && (
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" /> {summary.duplicateIds + summary.duplicateNames} duplicates skipped
                  </div>
                )}
                {summary.missingNames > 0 && (
                  <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                    <X className="h-4 w-4" /> {summary.missingNames} missing name
                  </div>
                )}
              </div>
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

function SummaryStat({ label, value, tone }: { label: string; value: number; tone: 'good' | 'warning' | 'error' | 'neutral' }) {
  const toneClasses = {
    good: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    error: 'text-rose-600 dark:text-rose-400',
    neutral: 'text-foreground',
  };
  return (
    <div className="rounded-lg border border-border p-2.5 text-center">
      <div className={`text-lg font-bold ${toneClasses[tone]}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: ExtractedEvent['status'] }) {
  if (status === 'valid') {
    return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">Import</Badge>;
  }
  if (status === 'duplicate_id' || status === 'duplicate_name') {
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">Duplicate</Badge>;
  }
  if (status === 'missing_name') {
    return <Badge className="bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800">Missing Name</Badge>;
  }
  return null;
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
