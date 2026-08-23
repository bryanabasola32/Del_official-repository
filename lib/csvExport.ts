import { toast } from 'sonner';

function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCSV(filename: string, rows: Record<string, unknown>[]): void {
  if (rows.length === 0) {
    toast.info('No data available to export yet.');
    return;
  }

  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.map(escapeCSVValue).join(','),
    ...rows.map((row) => headers.map((h) => escapeCSVValue(row[h])).join(',')),
  ];
  const csvString = csvLines.join('\r\n');

  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
