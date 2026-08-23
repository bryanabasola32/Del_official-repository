'use client';

import { useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Copy, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  parseSpreadsheet, type ParsedWorksheet,
} from '@/lib/spreadsheetParser';

type ExecutiveFieldName =
  | 'name'
  | 'title'
  | 'company'
  | 'industry'
  | 'email'
  | 'phone'
  | 'linkedin'
  | 'persona_provided'
  | 'notes';

const EXECUTIVE_COLUMN_PATTERNS: Record<ExecutiveFieldName, { patterns: string[]; required: boolean }> = {
  name: {
    patterns: ['name', 'executive name', 'full name', 'contact name', 'person name'],
    required: true,
  },
  title: {
    patterns: ['position', 'title', 'job title', 'role', 'designation'],
    required: true,
  },
  company: {
    patterns: ['company', 'organization', 'organisation', 'firm', 'employer'],
    required: true,
  },
  industry: {
    patterns: ['industry', 'sector', 'vertical', 'domain'],
    required: false,
  },
  email: {
    patterns: ['email', 'e-mail', 'email address', 'mail'],
    required: false,
  },
  phone: {
    patterns: ['phone', 'mobile', 'telephone', 'tel', 'contact number', 'cell'],
    required: false,
  },
  linkedin: {
    patterns: ['linkedin', 'linkedin url', 'linkedin profile'],
    required: false,
  },
  persona_provided: {
    patterns: ['persona', 'persona provided', 'background', 'bio'],
    required: false,
  },
  notes: {
    patterns: ['notes', 'remarks', 'comments', 'note'],
    required: false,
  },
};

interface ParsedRow {
  name: string;
  title: string;
  company: string;
  industry: string;
  email: string;
  phone: string;
  linkedin: string;
  persona_provided: string;
  notes: string;
  status: 'import' | 'duplicate' | 'missing_required';
  duplicateOf?: string;
  missingFields: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SAMPLE_CSV = `Name,Position,Company,Industry,Email,Phone,LinkedIn,Persona,Notes
Maria Santos,Chief Information Officer,BDO Unibank,Banking & Finance,msantos@bdo.com.ph,,https://linkedin.com/in/maria-santos,,
John Rafael Cruz,VP for Technology,SM Prime Holdings,Real Estate,,,https://linkedin.com/in/jrcruz,,
Angela Reyes Lim,Chief Digital Officer,Ayala Corporation,Conglomerates,alim@ayala.com.ph,,,,
Roberto Villanueva,Head of IT Infrastructure,Globe Telecom,Telecommunications,rvillanueva@globe.com.ph,,,,
Carmela Diaz,CTO,Metrobank,Banking & Finance,cdiaz@metrobank.com.ph,,,,
Eduardo Tan,Director of Digital Transformation,JG Summit Holdings,Conglomerates,etan@jgsummit.com.ph,,,,
Patricia Mendoza,CISO,UnionBank of the Philippines,Banking & Finance,pmendoza@unionbankph.com,,,,
Michael Reyes,VP IT Operations,PLDT,Telecommunications,,,,
Carlos Hernandez,Head of Digital,Robinsons Retail Holdings,Retail,,,,
Sofia Garcia,Chief Technology Officer,Bank of the Philippine Islands,Banking & Finance,sgarcia@bpi.com.ph,,,,`;

function detectExecutiveColumns(worksheet: ParsedWorksheet): Map<number, ExecutiveFieldName> {
  const mapping = new Map<number, ExecutiveFieldName>();
  const usedIndices = new Set<number>();

  for (let colIdx = 0; colIdx < worksheet.headers.length; colIdx++) {
    const header = worksheet.headers[colIdx].toLowerCase().trim();
    if (!header || usedIndices.has(colIdx)) continue;

    let bestField: ExecutiveFieldName | null = null;
    let bestScore = 0;

    for (const [field, config] of Object.entries(EXECUTIVE_COLUMN_PATTERNS)) {
      for (const pattern of config.patterns) {
        if (header === pattern) {
          bestField = field as ExecutiveFieldName;
          bestScore = 2;
          break;
        }
        if (header.includes(pattern)) {
          const score = pattern.length / header.length + 0.3;
          if (score > bestScore) {
            bestScore = score;
            bestField = field as ExecutiveFieldName;
          }
        }
      }
      if (bestScore >= 2) break;
    }

    if (bestField && bestScore >= 0.5 && !usedIndices.has(colIdx)) {
      mapping.set(colIdx, bestField);
      usedIndices.add(colIdx);
    }
  }

  return mapping;
}

function extractExecutives(worksheet: ParsedWorksheet): ParsedRow[] {
  const columnMap = detectExecutiveColumns(worksheet);
  const parsed: ParsedRow[] = [];
  const seen = new Map<string, string>();

  for (let rowIdx = 0; rowIdx < worksheet.rows.length; rowIdx++) {
    const row = worksheet.rows[rowIdx];
    if (!row.some((c) => c.length > 0)) continue;

    const raw: Record<string, string> = {};
    columnMap.forEach((field, colIdx) => {
      raw[field] = (row[colIdx] || '').trim();
    });

    const name = raw.name || '';
    const title = raw.title || '';
    const company = raw.company || '';
    const industry = raw.industry || '';
    const email = raw.email || '';
    const phone = raw.phone || '';
    const linkedin = raw.linkedin || '';
    const persona_provided = raw.persona_provided || '';
    const notes = raw.notes || '';

    if (!name && !company) continue;

    const missingFields: string[] = [];
    if (!name) missingFields.push('Name');
    if (!company) missingFields.push('Company');
    if (!title) missingFields.push('Position');

    const normalizedCompany = normalizeCompanyName(company);
    const key = `${name.toLowerCase()}|${normalizedCompany.toLowerCase()}`;

    let status: ParsedRow['status'] = 'import';
    let duplicateOf: string | undefined;

    if (missingFields.length > 0) {
      status = 'missing_required';
    } else if (seen.has(key)) {
      status = 'duplicate';
      duplicateOf = seen.get(key);
    } else {
      seen.set(key, name);
    }

    parsed.push({
      name, title, company: normalizedCompany, industry, email, phone,
      linkedin, persona_provided, notes, status, duplicateOf, missingFields,
    });
  }

  return parsed;
}

export function ImportExecutivesDialog({ open, onOpenChange }: Props) {
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    try {
      const result = await parseSpreadsheet(file);
      const sheet = result.worksheets[result.selectedSheetIndex];
      const parsed = extractExecutives(sheet);
      setRows(parsed);
      setStep('review');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to parse the spreadsheet.';
      toast.error(msg);
    }
  }, []);

  const loadSample = () => {
    setFileName('sample-executives.csv');
    const lines = SAMPLE_CSV.trim().split('\n');
    const headers = lines[0].split(',').map((h) => h.trim());
    const dataRows: string[][] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      dataRows.push(cols);
    }
    const sheet: ParsedWorksheet = {
      name: 'CSV Data',
      headers,
      rows: dataRows,
      rowCount: dataRows.length,
    };
    const parsed = extractExecutives(sheet);
    setRows(parsed);
    setStep('review');
  };

  const handleProceed = async () => {
    const toImport = rows.filter((r) => r.status === 'import');
    if (toImport.length === 0) {
      toast.error('No valid rows to import');
      return;
    }

    const inserts = toImport.map((r) => ({
      name: r.name,
      title: r.title || null,
      company: r.company,
      industry: r.industry || null,
      email: r.email || null,
      phone: r.phone || null,
      linkedin: r.linkedin || null,
      persona_provided: r.persona_provided || null,
      notes: r.notes || null,
      import_status: 'imported',
      persona_status: 'pending',
    }));

    const { error } = await supabase.from('contacts').insert(inserts);
    if (error) {
      toast.error('Import failed: ' + error.message);
      return;
    }

    await supabase.from('activity_log').insert({
      action_type: 'import',
      status: 'success',
      description: `Imported ${toImport.length} executives from ${fileName}`,
    });

    toast.success(`Imported ${toImport.length} executives`);
    setStep('done');
  };

  const reset = () => {
    setStep('upload');
    setRows([]);
    setFileName('');
  };

  const importable = rows.filter((r) => r.status === 'import').length;
  const duplicates = rows.filter((r) => r.status === 'duplicate').length;
  const missingRequired = rows.filter((r) => r.status === 'missing_required').length;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setTimeout(reset, 300); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-thin">
        {step === 'upload' && (
          <>
            <DialogHeader>
              <DialogTitle>Import Executives</DialogTitle>
              <DialogDescription>
                Upload a spreadsheet (.xlsx, .xls, .csv) with your executive roster. I'll validate and deduplicate before writing anything.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => document.getElementById('import-file')?.click()}
              >
                <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Click to upload spreadsheet</p>
                <p className="text-xs text-muted-foreground mt-1">No fixed template required — I'll detect columns automatically</p>
                <input
                  id="import-file"
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files?.[0])}
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <Button variant="outline" className="w-full" onClick={loadSample}>
                <Copy className="h-4 w-4 mr-2" />
                Load Sample Executive Roster
              </Button>
              <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground mb-1">Required columns: Name, Position, Company</p>
                <p>Optional columns: Industry, Email, Phone, LinkedIn, Persona, Notes</p>
              </div>
            </div>
          </>
        )}

        {step === 'review' && (
          <>
            <DialogHeader>
              <DialogTitle>Review Import — {fileName}</DialogTitle>
              <DialogDescription>
                I found {rows.length} rows. Confirm which ones to import.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20 p-3 text-center">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{importable}</div>
                  <div className="text-xs text-emerald-700 dark:text-emerald-500">Ready to Import</div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3 text-center">
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{duplicates}</div>
                  <div className="text-xs text-amber-700 dark:text-amber-500">Duplicates</div>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20 p-3 text-center">
                  <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{missingRequired}</div>
                  <div className="text-xs text-rose-700 dark:text-rose-500">Missing Required</div>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto scrollbar-thin rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium text-xs">Name</th>
                      <th className="text-left p-2 font-medium text-xs">Position</th>
                      <th className="text-left p-2 font-medium text-xs">Company</th>
                      <th className="text-left p-2 font-medium text-xs">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="p-2 font-medium">{row.name || <span className="text-rose-500">—</span>}</td>
                        <td className="p-2 text-muted-foreground">{row.title || <span className="text-rose-500">—</span>}</td>
                        <td className="p-2 text-muted-foreground">{row.company || <span className="text-rose-500">—</span>}</td>
                        <td className="p-2">
                          {row.status === 'import' && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">Import</Badge>}
                          {row.status === 'duplicate' && <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">Duplicate</Badge>}
                          {row.status === 'missing_required' && (
                            <Badge className="bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800">
                              Missing: {row.missingFields.join(', ')}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={reset}>Cancel</Button>
              <Button onClick={handleProceed} disabled={importable === 0}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Import {importable} Executive{importable !== 1 ? 's' : ''}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'done' && (
          <>
            <DialogHeader>
              <DialogTitle>Import Complete</DialogTitle>
              <DialogDescription>
                Successfully imported {importable} executives. They're now in your Executive List, ready for intelligence generation.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 flex flex-col items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-4">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex gap-2 text-sm">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> {importable} imported
                </div>
                {duplicates > 0 && (
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" /> {duplicates} duplicates skipped
                  </div>
                )}
                {missingRequired > 0 && (
                  <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                    <X className="h-4 w-4" /> {missingRequired} missing required fields
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

function normalizeCompanyName(name: string): string {
  return name
    .replace(/\bInc\.?$/i, '')
    .replace(/\bCorp\.?$/i, '')
    .replace(/\bCorporation$/i, '')
    .replace(/\bHoldings$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}
