'use client';

import type { jsPDF } from 'jspdf';
import { LocationPhoto, LocationSet, LocationStatus, Project } from '@/lib/storage';

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'long',
  year: 'numeric'
});

const dateTimeFormatter = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

const STATUS_LABELS: Record<LocationStatus, string> = {
  pending: 'Pendiente',
  approved: 'Apta',
  rejected: 'No apta'
};

interface ParagraphOptions {
  doc: jsPDF;
  text: string;
  x: number;
  y: number;
  width: number;
  lineHeight?: number;
  marginTop: number;
  marginBottom: number;
}

export interface SectionHeaderOptions {
  x: number;
  y: number;
  width: number;
  subtitle?: string;
  marginBottom?: number;
}

export interface KeyValueOptions {
  x: number;
  y: number;
  width: number;
  labelWidth?: number;
  lineHeight?: number;
  marginBottom?: number;
}

export interface ImageGridOptions {
  doc: jsPDF;
  startX: number;
  startY: number;
  maxWidth: number;
  marginTop: number;
  marginBottom: number;
  gap?: number;
  columns?: number;
  captionFontSize?: number;
  captions?: string[];
  maxImageHeight?: number;
}

interface LocationInfoOptions {
  doc: jsPDF;
  location: LocationSet;
  startY: number;
  marginTop: number;
  marginBottom: number;
  contentWidth: number;
}

interface LocationSummary {
  name: string;
  status: string;
  summary: string;
  page: number;
}

function formatDate(value?: string): string {
  const target = value ? new Date(value) : new Date();
  if (Number.isNaN(target.getTime())) {
    return '';
  }

  return dateFormatter.format(target);
}

function formatDateTime(value?: string): string {
  if (!value) {
    return 'Sin registro';
  }

  const target = new Date(value);
  if (Number.isNaN(target.getTime())) {
    return 'Sin registro';
  }

  return dateTimeFormatter.format(target);
}

function ensureSpace(doc: jsPDF, currentY: number, required: number, marginTop: number, marginBottom: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + required > pageHeight - marginBottom) {
    doc.addPage();
    return marginTop;
  }

  return currentY;
}

function writeParagraph(options: ParagraphOptions): number {
  const { doc, text, x, width, marginTop, marginBottom } = options;
  const lineHeight = options.lineHeight ?? 14;
  let cursorY = options.y;

  const paragraphs = text.split(/\r?\n/);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);

  paragraphs.forEach((paragraph, index) => {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      cursorY = ensureSpace(doc, cursorY, lineHeight, marginTop, marginBottom);
      cursorY += lineHeight;
      return;
    }

    const lines = doc.splitTextToSize(trimmed, width);
    lines.forEach((line) => {
      cursorY = ensureSpace(doc, cursorY, lineHeight, marginTop, marginBottom);
      doc.text(line, x, cursorY);
      cursorY += lineHeight;
    });

    if (index < paragraphs.length - 1) {
      cursorY += lineHeight / 2;
    }
  });

  return cursorY;
}

function getPhotoCaptions(photos: LocationPhoto[]): string[] {
  return photos.map((photo, index) => {
    const label = formatDateTime(photo.createdAt);
    if (!label || label === 'Sin registro') {
      return 'Foto ' + (index + 1);
    }

    return label;
  });
}

function getLocationSummary(location: LocationSet): string {
  const trimmed = location.notes.trim();
  if (!trimmed) {
    return 'Sin notas registradas.';
  }

  const firstLine = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    return 'Sin notas registradas.';
  }

  if (firstLine.length <= 90) {
    return firstLine;
  }

  return firstLine.slice(0, 87) + '…';
}

async function yieldToBrowser(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function renderLocationInformation(options: LocationInfoOptions): number {
  const { doc, location, marginTop, marginBottom, contentWidth } = options;
  let cursorY = options.startY;

  cursorY = ensureSpace(doc, cursorY, 60, marginTop, marginBottom);
  cursorY = addSectionHeader(doc, 'Ficha rápida', { x: marginTop, y: cursorY, width: contentWidth });
  cursorY = addKeyValue(doc, 'ID', location.id, { x: marginTop, y: cursorY, width: contentWidth });
  const statusLabel = STATUS_LABELS[location.status] ?? STATUS_LABELS.pending;
  cursorY = addKeyValue(doc, 'Estado', statusLabel, { x: marginTop, y: cursorY, width: contentWidth });
  cursorY = addKeyValue(doc, 'Última actualización', formatDateTime(location.updatedAt), {
    x: marginTop,
    y: cursorY,
    width: contentWidth
  });
  const coordsValue = location.coords
    ? location.coords.lat.toFixed(6) + ', ' + location.coords.lng.toFixed(6)
    : 'Sin coordenadas registradas.';
  cursorY = addKeyValue(doc, 'Coordenadas', coordsValue, { x: marginTop, y: cursorY, width: contentWidth });

  const notesContent = location.notes.trim() ? location.notes : 'Sin notas registradas.';
  cursorY = ensureSpace(doc, cursorY, 60, marginTop, marginBottom);
  cursorY = addSectionHeader(doc, 'Notas y observaciones', {
    x: marginTop,
    y: cursorY,
    width: contentWidth,
    subtitle: 'Resumen de comentarios y hallazgos registrados para la localización.'
  });
  cursorY = writeParagraph({
    doc,
    text: notesContent,
    x: marginTop,
    y: cursorY,
    width: contentWidth,
    marginTop,
    marginBottom
  });
  cursorY += 8;

  if (location.photos.length > 0) {
    cursorY = ensureSpace(doc, cursorY, 80, marginTop, marginBottom);
    cursorY = addSectionHeader(doc, 'Galería fotográfica', {
      x: marginTop,
      y: cursorY,
      width: contentWidth,
      subtitle: 'Referencias visuales con fecha y hora de captura.'
    });
    const captions = getPhotoCaptions(location.photos);
    const gridEnd = addImageGrid(
      location.photos.map((photo) => photo.dataUrl),
      {
        doc,
        startX: marginTop,
        startY: cursorY,
        maxWidth: contentWidth,
        marginTop,
        marginBottom,
        captions
      }
    );
    cursorY = gridEnd + 12;
  } else {
    cursorY = ensureSpace(doc, cursorY, 24, marginTop, marginBottom);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text('No hay fotos registradas para esta localización.', marginTop, cursorY);
    cursorY += 14;
  }

  return cursorY;
}

export function addSectionHeader(doc: jsPDF, text: string, options: SectionHeaderOptions): number {
  const { x, y, width, subtitle } = options;
  const marginBottom = options.marginBottom ?? 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(text, x, y);

  const lineY = y + 6;
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.5);
  doc.line(x, lineY, x + width, lineY);

  let cursorY = lineY + 12;
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(subtitle, width);
    doc.text(lines, x, cursorY);
    cursorY += lines.length * 14 + 4;
  }

  return cursorY + marginBottom;
}

export function addKeyValue(doc: jsPDF, label: string, value: string, options: KeyValueOptions): number {
  const { x, y, width } = options;
  const labelWidth = options.labelWidth ?? 120;
  const lineHeight = options.lineHeight ?? 14;
  const marginBottom = options.marginBottom ?? 10;

  const valueX = x + labelWidth;
  const availableWidth = Math.max(0, width - labelWidth);
  const displayValue = value && value.trim() ? value : '—';
  const lines = doc.splitTextToSize(displayValue, availableWidth);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(label + ':', x, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  lines.forEach((line, index) => {
    const lineY = y + index * lineHeight;
    doc.text(line, valueX, lineY);
  });

  return y + Math.max(1, lines.length) * lineHeight + marginBottom;
}

export function addImageGrid(images: string[], options: ImageGridOptions): number {
  const { doc, startX, marginTop, marginBottom } = options;
  const gap = options.gap ?? 12;
  const columns = options.columns ?? (options.maxWidth >= 420 ? 3 : 2);
  const captionFontSize = options.captionFontSize ?? 10;
  const captions = options.captions ?? [];
  const maxImageHeight = options.maxImageHeight ?? 180;

  if (images.length === 0) {
    return options.startY;
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  const availableWidth = options.maxWidth - gap * (columns - 1);
  const baseCellWidth = availableWidth / columns;
  let cursorY = options.startY;
  let rowHeight = 0;
  let columnIndex = 0;

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const props = doc.getImageProperties(image);
    const aspectRatio = props.width && props.height ? props.width / props.height : 1;

    let imageWidth = baseCellWidth;
    let imageHeight = imageWidth / aspectRatio;

    if (imageHeight > maxImageHeight) {
      imageHeight = maxImageHeight;
      imageWidth = imageHeight * aspectRatio;
      if (imageWidth > baseCellWidth) {
        imageWidth = baseCellWidth;
        imageHeight = imageWidth / aspectRatio;
      }
    }

    const caption = captions[index] ?? '';
    const hasCaption = caption.trim().length > 0;
    const captionSpacing = hasCaption ? 6 : 0;
    const captionHeight = hasCaption ? 14 : 0;
    const requiredHeight = imageHeight + captionSpacing + captionHeight;

    if (cursorY + requiredHeight > pageHeight - marginBottom) {
      doc.addPage();
      cursorY = marginTop;
      columnIndex = 0;
      rowHeight = 0;
    }

    const offsetX = startX + columnIndex * (baseCellWidth + gap) + (baseCellWidth - imageWidth) / 2;
    const format = props.fileType || 'JPEG';
    doc.addImage(image, format, offsetX, cursorY, imageWidth, imageHeight);

    if (hasCaption) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(captionFontSize);
      doc.text(caption, offsetX + imageWidth / 2, cursorY + imageHeight + captionSpacing + captionHeight / 2, {
        align: 'center'
      });
    }

    rowHeight = Math.max(rowHeight, requiredHeight);
    columnIndex += 1;

    if (columnIndex === columns || index === images.length - 1) {
      cursorY += rowHeight + gap;
      columnIndex = 0;
      rowHeight = 0;
    }
  }

  return cursorY - gap;
}

export async function exportLocationPdf(project: Project, location: LocationSet): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginTop = 76;
  const marginBottom = 76;
  const contentWidth = pageWidth - marginTop * 2;

  doc.setTextColor(20, 20, 20);

  let cursorY = marginTop;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text('Ficha de localización', pageWidth / 2, cursorY, { align: 'center' });
  cursorY += 38;

  doc.setFontSize(20);
  doc.text(location.name, pageWidth / 2, cursorY, { align: 'center' });
  cursorY += 28;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text('Proyecto: ' + project.name, pageWidth / 2, cursorY, { align: 'center' });
  cursorY += 18;
  doc.text('Generado el ' + formatDate(), pageWidth / 2, cursorY, { align: 'center' });
  cursorY += 32;

  cursorY = renderLocationInformation({
    doc,
    location,
    startY: cursorY,
    marginTop,
    marginBottom,
    contentWidth
  });

  await yieldToBrowser();
  doc.save('Localizacion-' + location.id + '.pdf');
}

export async function exportProjectPdf(project: Project): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginTop = 76;
  const marginBottom = 76;
  const contentWidth = pageWidth - marginTop * 2;

  doc.setTextColor(20, 20, 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text('Informe de proyecto', pageWidth / 2, marginTop + 10, { align: 'center' });
  doc.setFontSize(22);
  doc.text(project.name, pageWidth / 2, marginTop + 54, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text('Generado el ' + formatDate(), pageWidth / 2, marginTop + 84, { align: 'center' });
  doc.text('Localizaciones registradas: ' + project.locations.length, pageWidth / 2, marginTop + 110, {
    align: 'center'
  });

  const lineHeight = 18;
  const indexHeaderHeight = 56;
  const availableIndexHeight = pageHeight - marginTop - marginBottom - indexHeaderHeight;
  const linesPerPage = Math.max(1, Math.floor(availableIndexHeight / lineHeight));
  const indexPageCount = Math.max(1, Math.ceil(project.locations.length / linesPerPage));
  const indexPages: number[] = [];

  for (let page = 0; page < indexPageCount; page += 1) {
    doc.addPage();
    indexPages.push(doc.getNumberOfPages());
  }

  const summaries: LocationSummary[] = [];

  for (const location of project.locations) {
    doc.addPage();
    const pageNumber = doc.getNumberOfPages();
    const statusLabel = STATUS_LABELS[location.status] ?? STATUS_LABELS.pending;
    summaries.push({
      name: location.name,
      status: statusLabel,
      summary: getLocationSummary(location),
      page: pageNumber
    });

    let cursorY = marginTop;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(location.name, marginTop, cursorY);
    cursorY += 28;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text('Proyecto: ' + project.name, marginTop, cursorY);
    cursorY += 16;
    doc.text('Estado: ' + statusLabel, marginTop, cursorY);
    cursorY += 16;
    doc.text('Última actualización: ' + formatDateTime(location.updatedAt), marginTop, cursorY);
    cursorY += 20;

    cursorY = renderLocationInformation({
      doc,
      location,
      startY: cursorY,
      marginTop,
      marginBottom,
      contentWidth
    });

    await yieldToBrowser();
  }

  let entryIndex = 0;
  indexPages.forEach((pageNumber, index) => {
    doc.setPage(pageNumber);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('Índice de localizaciones', marginTop, marginTop);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text('Resumen de ubicaciones y página de referencia.', marginTop, marginTop + 24);

    let cursorY = marginTop + indexHeaderHeight;
    const limitY = pageHeight - marginBottom;

    if (summaries.length === 0 && index === 0) {
      doc.text('No hay localizaciones registradas en este proyecto.', marginTop, cursorY);
      return;
    }

    while (entryIndex < summaries.length && cursorY <= limitY - lineHeight) {
      const entry = summaries[entryIndex];
      const line = (entryIndex + 1).toString().padStart(2, '0') + '. ' + entry.name + ' — ' + entry.status;
      const summaryLines = doc.splitTextToSize(entry.summary, contentWidth - 80);

      doc.setFont('helvetica', 'bold');
      doc.text(line, marginTop, cursorY);
      doc.setFont('helvetica', 'normal');
      summaryLines.forEach((summaryLine, summaryIndex) => {
        const summaryY = cursorY + (summaryIndex + 1) * 12;
        if (summaryY > limitY) {
          return;
        }
        doc.text(summaryLine, marginTop + 12, summaryY);
      });
      doc.text(String(entry.page), pageWidth - marginTop, cursorY, { align: 'right' });

      cursorY += Math.max(lineHeight, summaryLines.length * 12 + lineHeight / 2);
      entryIndex += 1;
    }
  });

  doc.setPage(doc.getNumberOfPages());
  await yieldToBrowser();
  doc.save('Proyecto-' + project.id + '.pdf');
}
