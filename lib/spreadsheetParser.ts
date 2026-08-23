import * as XLSX from 'xlsx';

/*
 * Spreadsheet Parser — parses CSV, XLS, and XLSX files into a structured
 * representation that the Import Wizard can work with.
 *
 * Features:
 *   - Detects all worksheets in a workbook
 *   - Automatically selects the worksheet with the largest valid event dataset
 *   - Allows the user to choose which sheet to import
 *   - Does NOT assume the first worksheet is always correct
 *   - Handles quoted CSV fields with embedded commas and newlines
 *   - Returns raw rows + headers for the column detector to work with
 */

export interface ParsedWorksheet {
  /** Sheet name from the workbook */
  name: string;
  /** Headers (first row, after trimming) */
  headers: string[];
  /** Data rows (array of arrays, aligned with headers) */
  rows: string[][];
  /** Number of data rows (excluding header) */
  rowCount: number;
}

export interface ParsedSpreadsheet {
  /** Original file name */
  fileName: string;
  /** All detected worksheets */
  worksheets: ParsedWorksheet[];
  /** Index of the auto-selected worksheet (largest valid dataset) */
  selectedSheetIndex: number;
}

/**
 * Parse a spreadsheet file (CSV, XLS, or XLSX) into structured worksheets.
 */
export async function parseSpreadsheet(file: File): Promise<ParsedSpreadsheet> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'csv' || ext === 'txt') {
    const text = await file.text();
    return parseCSVText(text, file.name);
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer();
    return parseExcelBuffer(buffer, file.name);
  }

  throw new Error(`Unsupported file format: .${ext}. Please upload CSV, XLS, or XLSX.`);
}

/**
 * Parse CSV text into a ParsedSpreadsheet.
 * Uses a proper CSV parser that handles quoted fields with embedded commas and newlines.
 */
function parseCSVText(text: string, fileName: string): ParsedSpreadsheet {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('The file appears to be empty.');
  }

  const rows = parseCSVRows(trimmed);
  if (rows.length < 2) {
    throw new Error('No data rows found. The file must have a header row and at least one data row.');
  }

  const headers = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1).map((r) => r.map((c) => c.trim()));

  const worksheet: ParsedWorksheet = {
    name: 'CSV Data',
    headers,
    rows: dataRows,
    rowCount: dataRows.length,
  };

  return {
    fileName,
    worksheets: [worksheet],
    selectedSheetIndex: 0,
  };
}

/**
 * Parse an Excel file buffer into a ParsedSpreadsheet with all worksheets.
 */
function parseExcelBuffer(buffer: ArrayBuffer, fileName: string): ParsedSpreadsheet {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetNames = workbook.SheetNames;

  if (sheetNames.length === 0) {
    throw new Error('No worksheets detected in the Excel file.');
  }

  const worksheets: ParsedWorksheet[] = [];
  let bestIndex = 0;
  let bestRowCount = 0;

  for (let i = 0; i < sheetNames.length; i++) {
    const sheet = workbook.Sheets[sheetNames[i]];
    const jsonRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    });

    if (jsonRows.length < 2) continue;

    const headers = (jsonRows[0] as unknown[]).map((h) => String(h ?? '').trim());
    const dataRows = jsonRows.slice(1).map((row) =>
      (row as unknown[]).map((c) => String(c ?? '').trim()),
    );

    // Count valid rows (rows with at least one non-empty cell)
    const validRows = dataRows.filter((r) => r.some((c) => c.length > 0)).length;

    const worksheet: ParsedWorksheet = {
      name: sheetNames[i],
      headers,
      rows: dataRows,
      rowCount: validRows,
    };

    worksheets.push(worksheet);

    if (validRows > bestRowCount) {
      bestRowCount = validRows;
      bestIndex = worksheets.length - 1;
    }
  }

  if (worksheets.length === 0) {
    throw new Error('Unable to recognize any valid worksheet with event data. Please verify the spreadsheet format.');
  }

  return {
    fileName,
    worksheets,
    selectedSheetIndex: bestIndex,
  };
}

/**
 * Proper CSV row parser that handles quoted fields with embedded commas,
 * newlines within quotes, and escaped quotes ("").
 */
function parseCSVRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          // Escaped quote
          currentField += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        currentField += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
        i++;
      } else if (char === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
      } else if (char === '\r') {
        // Handle \r\n line endings
        i++;
      } else {
        currentField += char;
        i++;
      }
    }
  }

  // Push the last field and row
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}
