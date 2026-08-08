'use client';

import { Invoice } from './invoice';

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

/** Filename like "Invoice-00017-Acme.pdf". */
export function pdfFilename(data: Invoice): string {
  const bits = [
    'Invoice',
    data.invoiceNo.trim(),
    data.clientCompany.trim().replace(/[^\w\s-]/g, ''),
  ].filter(Boolean);
  return `${bits.join('-').replace(/\s+/g, '-')}.pdf`;
}

/**
 * Rasterises the on-screen invoice sheet into an A4 PDF.
 *
 * Capturing the live preview node keeps the PDF and the printed page from
 * drifting apart — there's only one layout to maintain. The trade-off is an
 * image-based PDF: the text isn't selectable. Use Print → Save as PDF if you
 * need a vector copy.
 */
export async function renderInvoicePdf(): Promise<Blob> {
  const node = document.getElementById('invoice-sheet');
  if (!node) throw new Error('Invoice preview not found on the page.');

  // Imported lazily so this ~200 kB of canvas/PDF code stays out of first load.
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ]);

  const canvas = await html2canvas(node, {
    scale: 2, // legible text at print size
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
  });

  // JPEG, not PNG: html2canvas' antialiasing defeats PNG's flat-colour
  // compression and produced ~10 MB files, over most mail servers' limits.
  // At quality 0.95 and 2x scale the text stays clean and the file is <1 MB.
  const image = canvas.toDataURL('image/jpeg', 0.95);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const imageHeightMm = (canvas.height * A4_WIDTH_MM) / canvas.width;

  doc.addImage(image, 'JPEG', 0, 0, A4_WIDTH_MM, imageHeightMm, '', 'FAST');

  // Long invoices spill onto extra pages by shifting the same image upwards.
  let remaining = imageHeightMm - A4_HEIGHT_MM;
  let offset = 0;
  while (remaining > 1) {
    offset -= A4_HEIGHT_MM;
    doc.addPage();
    doc.addImage(image, 'JPEG', 0, offset, A4_WIDTH_MM, imageHeightMm, '', 'FAST');
    remaining -= A4_HEIGHT_MM;
  }

  return doc.output('blob');
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000; // avoid blowing the argument limit on big files
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Triggers a normal browser download of the generated PDF. */
export async function downloadInvoicePdf(data: Invoice): Promise<void> {
  const blob = await renderInvoicePdf();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = pdfFilename(data);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
