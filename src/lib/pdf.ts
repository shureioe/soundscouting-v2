import { Project } from '@/lib/storage';

function formatDate(): string {
  return new Date().toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function extractSummary(text: string): string {
  if (!text.trim()) {
    return '';
  }

  const segments = text
    .split(/\n{2,}|\r\n{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length > 0) {
    return segments[0];
  }

  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine ?? '';
}

export async function exportProjectPdf(project: Project): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text('Informe de proyecto', pageWidth / 2, 120, { align: 'center' });

  doc.setFontSize(20);
  doc.text(project.name, pageWidth / 2, 160, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text('Generado el ' + formatDate(), pageWidth / 2, 190, { align: 'center' });

  if (project.locations.length === 0) {
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Localizaciones', 72, 100);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text('No hay localizaciones registradas en este proyecto todavía.', 72, 140);
    doc.save('Proyecto-' + project.id + '.pdf');
    return;
  }

  project.locations.forEach((location, index) => {
    if (index > 0) {
      doc.addPage();
    }

    const topMargin = 100;
    const leftMargin = 72;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Localización ' + (index + 1), leftMargin, topMargin);
    doc.setFontSize(16);
    doc.text(location.name, leftMargin, topMargin + 30);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);

    const statusMap: Record<string, string> = {
      pending: 'Pendiente',
      approved: 'Apta',
      rejected: 'No apta'
    };

    const statusLabel = statusMap[location.status] ?? 'Pendiente';
    doc.text('Estado: ' + statusLabel, leftMargin, topMargin + 60);

    const summary = extractSummary(location.notes);
    if (summary) {
      doc.text('Notas:', leftMargin, topMargin + 90);
      doc.text(doc.splitTextToSize(summary, pageWidth - leftMargin * 2), leftMargin, topMargin + 110);
    }
  });

  doc.save('Proyecto-' + project.id + '.pdf');
}
