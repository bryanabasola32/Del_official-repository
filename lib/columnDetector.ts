import type { ParsedWorksheet } from './spreadsheetParser';

/*
 * Column Detector — intelligently maps spreadsheet columns to DEL event model
 * fields without requiring a fixed spreadsheet structure.
 *
 * Recognizes common variations of column names:
 *   "Event Name", "Name", "Event Title", "Title" → event_name
 *   "Date", "Event Date", "Start Date" → date
 *   "Time", "Event Time", "Start Time" → time
 *   "Venue", "Location", "Place", "Address" → venue
 *   "Organizer", "Host", "Organized By" → organizer
 *   "Description", "Desc", "Details", "Summary" → description
 *   "Industry", "Target Industry", "Industries" → target_industries
 *   "Format", "Event Format", "Type", "Event Type" → event_type
 *   "Duration", "Length", "Duration (hrs)" → duration
 *   "Pricing", "Cost", "Fee", "Price" → pricing
 *   "Target Companies", "Companies", "Target Organizations" → target_companies
 *   "Event ID", "ID", "Reference" → event_id
 *   "Capacity", "Max Capacity", "Max Attendees" → max_capacity
 *   "Theme", "Primary Theme", "Topic" → theme
 */

export type EventFieldName =
  | 'event_id'
  | 'event_name'
  | 'event_type'
  | 'industry'
  | 'description'
  | 'format'
  | 'duration'
  | 'date'
  | 'time'
  | 'pricing'
  | 'target_companies'
  | 'venue'
  | 'organizer'
  | 'max_capacity'
  | 'theme';

export interface ColumnMapping {
  /** The DEL event field this column maps to */
  field: EventFieldName;
  /** The original spreadsheet column header */
  spreadsheetColumn: string;
  /** Column index in the spreadsheet */
  columnIndex: number;
  /** Confidence in the mapping (0-1) */
  confidence: number;
  /** Whether this is a required field */
  required: boolean;
}

export interface ColumnDetectionResult {
  /** All detected column mappings */
  mappings: ColumnMapping[];
  /** Headers that were not mapped to any field */
  unmappedHeaders: string[];
  /** The worksheet that was analyzed */
  sheetName: string;
}

// Column name patterns for fuzzy matching (case-insensitive substring)
const COLUMN_PATTERNS: Record<EventFieldName, { patterns: string[]; required: boolean }> = {
  event_id: {
    patterns: ['event id', 'eventid', 'event code', 'reference', 'ref id', 'ref #', 'id'],
    required: false,
  },
  event_name: {
    patterns: ['event name', 'eventname', 'event title', 'name', 'title', 'event'],
    required: true,
  },
  event_type: {
    patterns: ['event type', 'type', 'category', 'event category'],
    required: false,
  },
  industry: {
    patterns: ['industry', 'target industry', 'industries', 'sector', 'target sector'],
    required: false,
  },
  description: {
    patterns: ['description', 'desc', 'details', 'summary', 'overview', 'about'],
    required: false,
  },
  format: {
    patterns: ['format', 'event format', 'delivery format', 'delivery', 'mode'],
    required: false,
  },
  duration: {
    patterns: ['duration', 'length', 'duration (hrs)', 'duration (hours)', 'hours', 'event duration'],
    required: false,
  },
  date: {
    patterns: ['date', 'event date', 'start date', 'day', 'when'],
    required: false,
  },
  time: {
    patterns: ['time', 'event time', 'start time', 'schedule'],
    required: false,
  },
  pricing: {
    patterns: ['pricing', 'price', 'cost', 'fee', 'registration fee', 'ticket price'],
    required: false,
  },
  target_companies: {
    patterns: ['target company', 'target companies', 'companies', 'target organization', 'target organizations', 'target org', 'organization'],
    required: false,
  },
  venue: {
    patterns: ['venue', 'location', 'place', 'address', 'where', 'site'],
    required: false,
  },
  organizer: {
    patterns: ['organizer', 'host', 'organized by', 'organised by', 'convenor', 'sponsor'],
    required: false,
  },
  max_capacity: {
    patterns: ['capacity', 'max capacity', 'max attendees', 'attendees', 'seats', 'limit'],
    required: false,
  },
  theme: {
    patterns: ['theme', 'primary theme', 'topic', 'subject', 'focus'],
    required: false,
  },
};

/**
 * Detect and map columns from a parsed worksheet.
 */
export function detectColumns(worksheet: ParsedWorksheet): ColumnDetectionResult {
  const mappings: ColumnMapping[] = [];
  const usedIndices = new Set<number>();

  // First pass: exact matches (highest confidence)
  for (let colIdx = 0; colIdx < worksheet.headers.length; colIdx++) {
    const header = worksheet.headers[colIdx].toLowerCase().trim();
    if (!header || usedIndices.has(colIdx)) continue;

    for (const [field, config] of Object.entries(COLUMN_PATTERNS)) {
      if (header === field.replace('_', ' ') || header === field) {
        mappings.push({
          field: field as EventFieldName,
          spreadsheetColumn: worksheet.headers[colIdx],
          columnIndex: colIdx,
          confidence: 1.0,
          required: config.required,
        });
        usedIndices.add(colIdx);
        break;
      }
    }
  }

  // Second pass: substring/pattern matches
  for (let colIdx = 0; colIdx < worksheet.headers.length; colIdx++) {
    if (usedIndices.has(colIdx)) continue;
    const header = worksheet.headers[colIdx].toLowerCase().trim();
    if (!header) continue;

    let bestField: EventFieldName | null = null;
    let bestConfidence = 0;

    for (const [field, config] of Object.entries(COLUMN_PATTERNS)) {
      for (const pattern of config.patterns) {
        if (header.includes(pattern)) {
          const confidence = pattern.length / header.length;
          if (confidence > bestConfidence) {
            bestConfidence = confidence;
            bestField = field as EventFieldName;
          }
        }
      }
    }

    if (bestField && bestConfidence >= 0.3) {
      mappings.push({
        field: bestField,
        spreadsheetColumn: worksheet.headers[colIdx],
        columnIndex: colIdx,
        confidence: Math.min(1.0, bestConfidence + 0.3),
        required: COLUMN_PATTERNS[bestField].required,
      });
      usedIndices.add(colIdx);
    }
  }

  // Find unmapped headers
  const unmappedHeaders = worksheet.headers
    .map((h, i) => ({ header: h, index: i }))
    .filter(({ header, index }) => header.trim() && !usedIndices.has(index))
    .map(({ header }) => header);

  return {
    mappings: mappings.sort((a, b) => b.confidence - a.confidence),
    unmappedHeaders,
    sheetName: worksheet.name,
  };
}

/**
 * Get a human-readable label for an event field.
 */
export function getFieldLabel(field: EventFieldName): string {
  const labels: Record<EventFieldName, string> = {
    event_id: 'Event ID',
    event_name: 'Event Name',
    event_type: 'Event Type',
    industry: 'Industry',
    description: 'Description',
    format: 'Event Format',
    duration: 'Duration',
    date: 'Date',
    time: 'Time',
    pricing: 'Pricing',
    target_companies: 'Target Organizations',
    venue: 'Venue',
    organizer: 'Organizer',
    max_capacity: 'Max Capacity',
    theme: 'Theme',
  };
  return labels[field];
}
