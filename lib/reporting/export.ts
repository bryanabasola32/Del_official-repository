import { downloadCSV, sanitizeFilename } from '../csvExport';
import type {
  ExecutiveReportRow,
  RecommendationReportRow,
  EventReportRow,
  DashboardSummary,
} from './reportMetrics';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ReportExportConfig {
  title: string;
  description: string;
  formats: ExportFormat[];
}

export const REPORT_EXPORT_CONFIG: Record<string, ReportExportConfig> = {
  executive: {
    title: 'Executive Intelligence Report',
    description: 'Executive personas, confidence, evidence, and key findings.',
    formats: ['pdf', 'csv'],
  },
  relationship: {
    title: 'Relationship Intelligence Report',
    description: 'Relationship context, engagement readiness, and relationship intelligence.',
    formats: ['pdf', 'csv'],
  },
  strategic: {
    title: 'Strategic Decision Analysis',
    description: 'Strategic decision reasoning and event/opportunity evaluation.',
    formats: ['pdf', 'csv'],
  },
  action: {
    title: 'Action Intelligence Report',
    description: 'Recommended actions and follow-up intelligence.',
    formats: ['pdf', 'csv'],
  },
  dashboard: {
    title: 'Dashboard Summary Report',
    description: 'Overall DEL intelligence and campaign metrics.',
    formats: ['pdf', 'csv'],
  },
  recommendations: {
    title: 'Recommendation Analysis',
    description: 'Event matching, executive recommendations, and score distribution.',
    formats: ['pdf', 'csv'],
  },
  spreadsheet: {
    title: 'Enhanced Executive Dataset',
    description: 'Structured executive/persona dataset suitable for spreadsheet export.',
    formats: ['xlsx', 'csv'],
  },
  event: {
    title: 'Event Intelligence Report',
    description: 'Event audience, match quality, campaign progress, and recommendations.',
    formats: ['pdf', 'csv'],
  },
  narrative: {
    title: 'Narrative Executive Brief',
    description: 'AI-generated executive-readable narrative report.',
    formats: ['pdf'],
  },
};

export function exportCSV(filename: string, rows: Record<string, unknown>[]): void {
  downloadCSV(filename, rows);
}

export async function exportXLSX(filename: string, rows: Record<string, unknown>[], sheetName = 'Report'): Promise<void> {
  if (rows.length === 0) return;
  const XLSX = await import('xlsx');
  const headers = Object.keys(rows[0]);
  const aoa = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
  XLSX.writeFile(wb, filename);
}

export async function exportPDF(filename: string, content: PDFReportContent): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin - 30) {
      addFooter();
      doc.addPage();
      y = margin;
    }
  };

  const addFooter = () => {
    const page = doc.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`DEL Intelligence Report — Page ${page}`, margin, pageHeight - 20);
    doc.text(new Date().toLocaleString(), pageWidth - margin - 100, pageHeight - 20);
  };

  // Title block
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30);
  const titleLines = doc.splitTextToSize(content.title, contentWidth);
  y += 10;
  for (const line of titleLines) {
    ensureSpace(24);
    doc.text(line, margin, y);
    y += 24;
  }

  if (content.scope) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    ensureSpace(16);
    doc.text(content.scope, margin, y);
    y += 16;
  }

  if (content.generatedAt) {
    doc.setFontSize(9);
    doc.setTextColor(150);
    ensureSpace(14);
    doc.text(`Generated ${content.generatedAt}`, margin, y);
    y += 14;
  }

  y += 8;
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  // Sections
  for (const section of content.sections) {
    ensureSpace(30);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text(section.title.toUpperCase(), margin, y);
    y += 18;

    if (section.text) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60);
      const textLines = doc.splitTextToSize(section.text, contentWidth);
      for (const line of textLines) {
        ensureSpace(14);
        doc.text(line, margin, y);
        y += 14;
      }
      y += 4;
    }

    if (section.metrics && section.metrics.length > 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      for (const metric of section.metrics) {
        ensureSpace(16);
        doc.setTextColor(80);
        doc.text(`${metric.label}:`, margin, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30);
        doc.text(String(metric.value), margin + 180, y);
        doc.setFont('helvetica', 'normal');
        y += 16;
      }
      y += 4;
    }

    if (section.findings && section.findings.length > 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60);
      for (const finding of section.findings) {
        const lines = doc.splitTextToSize(`• ${finding}`, contentWidth - 10);
        for (const line of lines) {
          ensureSpace(14);
          doc.text(line, margin + 5, y);
          y += 14;
        }
      }
      y += 4;
    }

    if (section.table && section.table.rows.length > 0) {
      const cols = section.table.columns;
      const colWidth = contentWidth / cols.length;
      const rowHeight = 16;

      ensureSpace(rowHeight * 2);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30);
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y - 12, contentWidth, rowHeight, 'F');
      for (let i = 0; i < cols.length; i++) {
        const cellText = doc.splitTextToSize(cols[i].label, colWidth - 6)[0] || '';
        doc.text(cellText, margin + i * colWidth + 3, y);
      }
      y += rowHeight;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60);
      for (const row of section.table.rows) {
        ensureSpace(rowHeight);
        for (let i = 0; i < cols.length; i++) {
          const val = String(row[cols[i].key] ?? '');
          const cellText = doc.splitTextToSize(val, colWidth - 6)[0] || '';
          doc.text(cellText, margin + i * colWidth + 3, y);
        }
        y += rowHeight;
      }
      y += 6;
    }

    y += 8;
  }

  addFooter();
  doc.save(filename);
}

export interface PDFReportContent {
  title: string;
  scope?: string;
  generatedAt?: string;
  sections: PDFReportSection[];
}

export interface PDFReportSection {
  title: string;
  text?: string;
  metrics?: { label: string; value: string | number }[];
  findings?: string[];
  table?: {
    columns: { key: string; label: string }[];
    rows: Record<string, unknown>[];
  };
}

// ── Report-specific PDF builders ──

export function buildExecutivePDF(rows: ExecutiveReportRow[]): PDFReportContent {
  const sections: PDFReportSection[] = [];

  sections.push({
    title: 'Executive Summary',
    metrics: [
      { label: 'Executives Analyzed', value: rows.length },
      { label: 'High Confidence', value: rows.filter((r) => r.persona_confidence_level === 'high').length },
      { label: 'Medium Confidence', value: rows.filter((r) => r.persona_confidence_level === 'medium').length },
      { label: 'Low Confidence', value: rows.filter((r) => r.persona_confidence_level === 'low').length },
    ],
  });

  const industries = new Map<string, number>();
  for (const r of rows) {
    if (r.industry) industries.set(r.industry, (industries.get(r.industry) || 0) + 1);
  }
  if (industries.size > 0) {
    sections.push({
      title: 'Industry Distribution',
      table: {
        columns: [{ key: 'industry', label: 'Industry' }, { key: 'count', label: 'Count' }],
        rows: Array.from(industries.entries()).map(([industry, count]) => ({ industry, count })),
      },
    });
  }

  sections.push({
    title: 'Detailed Executive Records',
    table: {
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'company', label: 'Company' },
        { key: 'persona_type', label: 'Persona' },
        { key: 'persona_confidence_level', label: 'Confidence' },
        { key: 'tech_readiness_level', label: 'Tech Readiness' },
      ],
      rows: rows as unknown as Record<string, unknown>[],
    },
  });

  return {
    title: 'Executive Intelligence Report',
    scope: `${rows.length} executives analyzed`,
    generatedAt: new Date().toLocaleString(),
    sections,
  };
}

export function buildDashboardPDF(summary: DashboardSummary): PDFReportContent {
  const sections: PDFReportSection[] = [];

  sections.push({
    title: 'Key Metrics',
    metrics: [
      { label: 'Executives Analyzed', value: summary.kpis.executivesAnalyzed },
      { label: 'High-Fit Matches', value: summary.kpis.highFitMatches },
      { label: 'Approved Attendees', value: summary.kpis.approvedAttendees },
      { label: 'Invitation Drafts', value: summary.kpis.invitationDrafts },
      { label: 'Industries Represented', value: summary.industriesRepresented },
      { label: 'Total Events', value: summary.totalEvents },
      { label: 'Active Events', value: summary.activeEvents },
      { label: 'Average Match Score', value: summary.averageMatchScore !== null ? `${summary.averageMatchScore}/100` : 'N/A' },
    ],
  });

  if (summary.personaDistribution.length > 0) {
    sections.push({
      title: 'Persona Distribution',
      table: {
        columns: [{ key: 'persona_type', label: 'Persona Type' }, { key: 'count', label: 'Count' }],
        rows: summary.personaDistribution as unknown as Record<string, unknown>[],
      },
    });
  }

  if (summary.confidenceDistribution.length > 0) {
    sections.push({
      title: 'Confidence Distribution',
      table: {
        columns: [{ key: 'level', label: 'Confidence Level' }, { key: 'count', label: 'Count' }],
        rows: summary.confidenceDistribution as unknown as Record<string, unknown>[],
      },
    });
  }

  return {
    title: 'Dashboard Summary Report',
    scope: 'Overall DEL intelligence and campaign metrics',
    generatedAt: new Date().toLocaleString(),
    sections,
  };
}

export function buildRecommendationPDF(rows: RecommendationReportRow[]): PDFReportContent {
  const highFit = rows.filter((r) => r.match_tier === 'High');
  const avgScore = rows.length > 0
    ? Math.round(rows.reduce((sum, r) => sum + r.total_score, 0) / rows.length)
    : null;

  const sections: PDFReportSection[] = [];

  sections.push({
    title: 'Summary',
    metrics: [
      { label: 'Total Matches', value: rows.length },
      { label: 'High-Fit Matches', value: highFit.length },
      { label: 'Approved Attendees', value: rows.filter((r) => r.is_final_attendee).length },
      { label: 'Average Match Score', value: avgScore !== null ? `${avgScore}/100` : 'N/A' },
    ],
  });

  const topRows = rows.slice(0, 50);
  sections.push({
    title: 'Top Executive Matches',
    table: {
      columns: [
        { key: 'contact_name', label: 'Executive' },
        { key: 'company', label: 'Company' },
        { key: 'event_name', label: 'Event' },
        { key: 'total_score', label: 'Score' },
        { key: 'match_tier', label: 'Tier' },
        { key: 'recommendation_status', label: 'Status' },
      ],
      rows: topRows as unknown as Record<string, unknown>[],
    },
  });

  return {
    title: 'Recommendation Analysis',
    scope: `${rows.length} total matches across all events`,
    generatedAt: new Date().toLocaleString(),
    sections,
  };
}

export function buildEventPDF(
  eventName: string,
  intel: { totalAnalyzed: number; highFit: number; mediumFit: number; lowFit: number; averageScore: number | null; approvedCount: number; pendingReview: number; rejectedCount: number; invitationCount: number },
  recommendations: RecommendationReportRow[],
): PDFReportContent {
  const sections: PDFReportSection[] = [];

  sections.push({
    title: 'Audience Overview',
    metrics: [
      { label: 'Executives Analyzed', value: intel.totalAnalyzed },
      { label: 'High-Fit', value: intel.highFit },
      { label: 'Medium-Fit', value: intel.mediumFit },
      { label: 'Low-Fit', value: intel.lowFit },
    ],
  });

  sections.push({
    title: 'Match Quality',
    metrics: [
      { label: 'Average Match Score', value: intel.averageScore !== null ? `${intel.averageScore}/100` : 'N/A' },
    ],
  });

  sections.push({
    title: 'Campaign Progress',
    metrics: [
      { label: 'Approved', value: intel.approvedCount },
      { label: 'Pending Review', value: intel.pendingReview },
      { label: 'Rejected', value: intel.rejectedCount },
      { label: 'Invitation Drafts', value: intel.invitationCount },
    ],
  });

  if (recommendations.length > 0) {
    sections.push({
      title: 'Recommendations',
      table: {
        columns: [
          { key: 'contact_name', label: 'Executive' },
          { key: 'company', label: 'Company' },
          { key: 'total_score', label: 'Score' },
          { key: 'match_tier', label: 'Tier' },
          { key: 'recommendation_status', label: 'Status' },
        ],
        rows: recommendations.slice(0, 50) as unknown as Record<string, unknown>[],
      },
    });
  }

  return {
    title: `Event Intelligence Report: ${eventName}`,
    scope: `${intel.totalAnalyzed} executives analyzed`,
    generatedAt: new Date().toLocaleString(),
    sections,
  };
}

export function buildNarrativePDF(title: string, narrative: string, scope?: string): PDFReportContent {
  return {
    title,
    scope,
    generatedAt: new Date().toLocaleString(),
    sections: [
      {
        title: 'Executive Brief',
        text: narrative,
      },
    ],
  };
}

export function buildFilename(prefix: string, ext: ExportFormat): string {
  return `${sanitizeFilename(prefix)}-${new Date().toISOString().split('T')[0]}.${ext}`;
}
