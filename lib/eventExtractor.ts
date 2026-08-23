import type { ParsedWorksheet } from './spreadsheetParser';
import type { ColumnDetectionResult, ColumnMapping, EventFieldName } from './columnDetector';

/*
 * Event Extractor — converts parsed spreadsheet rows into validated event
 * records using the column mapping from the Column Detector.
 *
 * Responsibilities:
 *   - Extract event data from each row using the column mapping
 *   - Parse target companies (comma-separated → array)
 *   - Parse target industries (comma-separated → array)
 *   - Validate dates and times
 *   - Detect duplicate event IDs and event names
 *   - Detect missing required fields (only event_name is critical)
 *   - Handle missing optional fields gracefully (venue, organizer → "Not Provided")
 *   - Never reject rows for missing optional fields
 */

export type RowStatus = 'valid' | 'missing_name' | 'duplicate_id' | 'duplicate_name';

export interface ExtractedEvent {
  event_id: string | null;
  event_name: string;
  event_type: string | null;
  industry: string | null;
  description: string | null;
  format: string | null;
  duration: string | null;
  date: string | null;
  time: string | null;
  pricing: string | null;
  target_companies: string[];
  venue: string | null;
  organizer: string | null;
  max_capacity: number | null;
  theme: string | null;
  /** Row number in the spreadsheet (1-indexed, after header) */
  rowNumber: number;
  /** Validation status */
  status: RowStatus;
  /** If duplicate, which event this duplicates */
  duplicateOf?: string;
  /** Validation issues */
  issues: string[];
}

export interface ExtractionResult {
  events: ExtractedEvent[];
  summary: ValidationSummary;
}

export interface ValidationSummary {
  totalEvents: number;
  validEvents: number;
  duplicateIds: number;
  duplicateNames: number;
  missingNames: number;
  invalidDates: number;
  invalidTimes: number;
  missingDescriptions: number;
  missingOptionalFields: number;
  readyToImport: boolean;
}

/**
 * Extract events from a parsed worksheet using the column mapping.
 */
export function extractEvents(
  worksheet: ParsedWorksheet,
  detection: ColumnDetectionResult,
): ExtractionResult {
  const fieldByColumn = new Map<number, EventFieldName>();
  for (const mapping of detection.mappings) {
    fieldByColumn.set(mapping.columnIndex, mapping.field);
  }

  const events: ExtractedEvent[] = [];
  const seenIds = new Map<string, number>();
  const seenNames = new Map<string, number>();

  for (let rowIdx = 0; rowIdx < worksheet.rows.length; rowIdx++) {
    const row = worksheet.rows[rowIdx];
    const issues: string[] = [];

    const raw: Partial<Record<EventFieldName, string>> = {};
    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const field = fieldByColumn.get(colIdx);
      if (field) {
        raw[field] = row[colIdx] || '';
      }
    }

    const eventName = (raw.event_name || '').trim();
    const eventId = (raw.event_id || '').trim() || null;

    // Parse target companies (comma-separated → array)
    const targetCompanies = parseList(raw.target_companies);

    // Parse target industries (comma-separated → array)
    const industries = parseList(raw.industry);

    // Parse and validate date
    const dateStr = (raw.date || '').trim();
    let date: string | null = null;
    let invalidDate = false;
    if (dateStr) {
      const parsed = parseDate(dateStr);
      if (parsed) {
        date = parsed;
      } else {
        invalidDate = true;
        issues.push(`Invalid date: "${dateStr}"`);
      }
    }

    // Parse and validate time
    const timeStr = (raw.time || '').trim();
    let time: string | null = null;
    let invalidTime = false;
    if (timeStr) {
      const parsed = parseTime(timeStr);
      if (parsed) {
        time = parsed;
      } else {
        invalidTime = true;
        issues.push(`Invalid time: "${timeStr}"`);
      }
    }

    // Parse max capacity
    let maxCapacity: number | null = null;
    if (raw.max_capacity) {
      const parsed = parseInt(raw.max_capacity.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(parsed) && parsed > 0) {
        maxCapacity = parsed;
      }
    }

    // Check missing optional fields
    let missingOptional = false;
    if (!raw.venue) missingOptional = true;
    if (!raw.organizer) missingOptional = true;

    // Determine row status
    let status: RowStatus = 'valid';
    let duplicateOf: string | undefined;

    if (!eventName) {
      status = 'missing_name';
      issues.push('Missing Event Name (required)');
    } else {
      // Check for duplicate names
      const nameKey = eventName.toLowerCase();
      if (seenNames.has(nameKey)) {
        status = 'duplicate_name';
        duplicateOf = `Row ${seenNames.get(nameKey)! + 2}`;
        issues.push(`Duplicate event name (same as ${duplicateOf})`);
      } else {
        seenNames.set(nameKey, rowIdx);
      }

      // Check for duplicate IDs (only if ID is present)
      if (eventId && status !== 'duplicate_name') {
        if (seenIds.has(eventId)) {
          status = 'duplicate_id';
          duplicateOf = `Row ${seenIds.get(eventId)! + 2}`;
          issues.push(`Duplicate Event ID "${eventId}" (same as ${duplicateOf})`);
        } else {
          seenIds.set(eventId, rowIdx);
        }
      }
    }

    events.push({
      event_id: eventId,
      event_name: eventName,
      event_type: (raw.event_type || '').trim() || null,
      industry: industries.length > 0 ? industries.join(', ') : null,
      description: (raw.description || '').trim() || null,
      format: (raw.format || '').trim() || null,
      duration: (raw.duration || '').trim() || null,
      date,
      time,
      pricing: (raw.pricing || '').trim() || null,
      target_companies: targetCompanies,
      venue: (raw.venue || '').trim() || null,
      organizer: (raw.organizer || '').trim() || null,
      max_capacity: maxCapacity,
      theme: (raw.theme || '').trim() || null,
      rowNumber: rowIdx + 2, // +2 because row 1 is header, and we're 0-indexed
      status,
      duplicateOf,
      issues,
    });
  }

  const summary = buildSummary(events);

  return { events, summary };
}

function buildSummary(events: ExtractedEvent[]): ValidationSummary {
  const validEvents = events.filter((e) => e.status === 'valid').length;
  const duplicateIds = events.filter((e) => e.status === 'duplicate_id').length;
  const duplicateNames = events.filter((e) => e.status === 'duplicate_name').length;
  const missingNames = events.filter((e) => e.status === 'missing_name').length;
  const invalidDates = events.filter((e) => e.issues.some((i) => i.includes('Invalid date'))).length;
  const invalidTimes = events.filter((e) => e.issues.some((i) => i.includes('Invalid time'))).length;
  const missingDescriptions = events.filter((e) => !e.description).length;
  const missingOptionalFields = events.filter((e) => !e.venue || !e.organizer).length;

  return {
    totalEvents: events.length,
    validEvents,
    duplicateIds,
    duplicateNames,
    missingNames,
    invalidDates,
    invalidTimes,
    missingDescriptions,
    missingOptionalFields,
    readyToImport: validEvents > 0,
  };
}

/**
 * Parse a comma-separated string into an array of trimmed, non-empty values.
 * Handles: "Ayala Land, Vista Land, Filinvest" → ["Ayala Land", "Vista Land", "Filinvest"]
 */
function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Parse a date string into ISO format (YYYY-MM-DD).
 * Handles various formats: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, Month DD, YYYY
 */
function parseDate(dateStr: string): string | null {
  // Try ISO format first
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) return dateStr.slice(0, 10);
  }

  // Try MM/DD/YYYY or M/D/YYYY
  const usMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) {
    const month = parseInt(usMatch[1], 10);
    const day = parseInt(usMatch[2], 10);
    const year = parseInt(usMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Try Date.parse for other formats (e.g. "October 14, 2026")
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

/**
 * Parse a time string into a normalized HH:MM format.
 * Handles: "2:00 PM", "14:00", "9am", "09:30"
 */
function parseTime(timeStr: string): string | null {
  const lower = timeStr.toLowerCase().trim();

  // HH:MM AM/PM
  const ampmMatch = lower.match(/^(\d{1,2}):(\d{2})\s*(am|pm)/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3];
    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  // HH AM/PM (no minutes)
  const ampmOnlyMatch = lower.match(/^(\d{1,2})\s*(am|pm)/);
  if (ampmOnlyMatch) {
    let hours = parseInt(ampmOnlyMatch[1], 10);
    const period = ampmOnlyMatch[2];
    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:00`;
  }

  // 24-hour HH:MM
  const hhmmMatch = lower.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmmMatch) {
    const hours = parseInt(hhmmMatch[1], 10);
    const minutes = parseInt(hhmmMatch[2], 10);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
  }

  return null;
}
