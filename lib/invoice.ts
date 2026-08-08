export type LineItem = {
  id: string;
  reference: string;
  workingHours: string;
  billableHours: string;
  price: string;
};

export type Invoice = {
  // Sender ("from") block
  senderName: string;
  senderAddress1: string;
  senderAddress2: string;
  senderPhone: string;

  // Invoice meta
  invoiceDate: string;
  invoicePeriod: string;
  invoiceNo: string;
  currency: string;

  // Bill to
  clientCompany: string;
  clientAddress: string;
  clientPhone: string;
  clientEmail: string;

  // Timesheet
  items: LineItem[];

  // Payment instructions
  accountNo: string;
  ifsc: string;
  panNo: string;
  extraRemarks: string;
};

export const emptyItem = (): LineItem => ({
  id: Math.random().toString(36).slice(2, 10),
  reference: '',
  workingHours: '',
  billableHours: '',
  price: '',
});

export const defaultInvoice: Invoice = {
  senderName: 'Your Name',
  senderAddress1: 'Address Line 1',
  senderAddress2: 'Address Line 2, City, State PIN: 000000',
  senderPhone: '+91 00000 00000',

  invoiceDate: '',
  invoicePeriod: '',
  invoiceNo: '',
  currency: '₹',

  clientCompany: '',
  clientAddress: '',
  clientPhone: '',
  clientEmail: '',

  // Fixed ids keep the server and client render identical on first paint.
  items: [
    { id: 'line-1', reference: '', workingHours: '', billableHours: '', price: '' },
    { id: 'line-2', reference: '', workingHours: '', billableHours: '', price: '' },
  ],

  accountNo: '',
  ifsc: '',
  panNo: '',
  extraRemarks: '',
};

export const num = (v: string) => {
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export const formatAmount = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatHours = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toFixed(2);

export function totals(items: LineItem[]) {
  return items.reduce(
    (acc, it) => ({
      workingHours: acc.workingHours + num(it.workingHours),
      billableHours: acc.billableHours + num(it.billableHours),
      price: acc.price + num(it.price),
    }),
    { workingHours: 0, billableHours: 0, price: 0 }
  );
}

/** Renders a value, or the template placeholder in muted style when empty. */
export const placeholder = (value: string, fallback: string) =>
  value.trim() ? value : fallback;

/** "00017" -> "00018", "INV-9" -> "INV-10". Left alone if there's no number. */
export function nextInvoiceNo(no: string): string {
  const m = no.trim().match(/^(.*?)(\d+)(\D*)$/);
  if (!m) return no;
  const [, prefix, digits, suffix] = m;
  const bumped = String(Number(digits) + 1).padStart(digits.length, '0');
  return `${prefix}${bumped}${suffix}`;
}
