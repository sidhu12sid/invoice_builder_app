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
  /**
   * Hourly rate, copied from the client when one is picked. When set, each
   * line's amount is billable hours × rate and the Price input goes read-only.
   * Blank falls back to hand-entered prices.
   */
  rate: string;

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
  // Left blank so the preview shows the template's bracketed placeholders and
  // "My details" has something to fill in.
  senderName: '',
  senderAddress1: '',
  senderAddress2: '',
  senderPhone: '',

  invoiceDate: '',
  invoicePeriod: '',
  invoiceNo: '',
  currency: '₹',
  rate: '',

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

/** True when a usable hourly rate is set. */
export const hasRate = (rate: string) => num(rate) > 0;

/**
 * A line's amount — the single source of truth. With a rate set it's derived
 * from billable hours; otherwise it's whatever was typed into Price.
 */
export function lineAmount(item: LineItem, rate: string): number {
  return hasRate(rate)
    ? num(item.billableHours) * num(rate)
    : num(item.price);
}

/** True when the line has nothing to show an amount for yet. */
export function lineAmountBlank(item: LineItem, rate: string): boolean {
  return hasRate(rate)
    ? item.billableHours.trim() === ''
    : item.price.trim() === '';
}

export function totals(items: LineItem[], rate: string) {
  return items.reduce(
    (acc, it) => ({
      workingHours: acc.workingHours + num(it.workingHours),
      billableHours: acc.billableHours + num(it.billableHours),
      price: acc.price + lineAmount(it, rate),
    }),
    { workingHours: 0, billableHours: 0, price: 0 }
  );
}

/** Renders a value, or the template placeholder in muted style when empty. */
export const placeholder = (value: string, fallback: string) =>
  value.trim() ? value : fallback;

/** Copies the saved "from" block and payment details onto an invoice. */
export function applyProfile<T extends Invoice>(
  invoice: T,
  profile: {
    fullName: string;
    addressLine1: string;
    addressLine2: string;
    phone: string;
    accountNo: string;
    ifsc: string;
    pan: string;
  }
): T {
  return {
    ...invoice,
    senderName: profile.fullName,
    senderAddress1: profile.addressLine1,
    senderAddress2: profile.addressLine2,
    senderPhone: profile.phone,
    accountNo: profile.accountNo,
    ifsc: profile.ifsc,
    panNo: profile.pan,
  };
}

/**
 * Like applyProfile, but only fills fields that are still blank. Used when the
 * profile loads after the page, so it can't overwrite something already typed.
 */
export function fillFromProfile<T extends Invoice>(
  invoice: T,
  profile: {
    fullName: string;
    addressLine1: string;
    addressLine2: string;
    phone: string;
    accountNo: string;
    ifsc: string;
    pan: string;
  }
): T {
  const keep = (current: string, incoming: string) =>
    current.trim() ? current : incoming;

  return {
    ...invoice,
    senderName: keep(invoice.senderName, profile.fullName),
    senderAddress1: keep(invoice.senderAddress1, profile.addressLine1),
    senderAddress2: keep(invoice.senderAddress2, profile.addressLine2),
    senderPhone: keep(invoice.senderPhone, profile.phone),
    accountNo: keep(invoice.accountNo, profile.accountNo),
    ifsc: keep(invoice.ifsc, profile.ifsc),
    panNo: keep(invoice.panNo, profile.pan),
  };
}

/** Copies a saved client into the Bill To block. */
export function applyClient<T extends Invoice>(
  invoice: T,
  client: {
    name: string;
    address: string;
    email: string;
    phone: string;
    rate?: string;
  }
): T {
  return {
    ...invoice,
    clientCompany: client.name,
    clientAddress: client.address,
    clientEmail: client.email,
    clientPhone: client.phone,
    // Copied, not linked: changing the client's rate later leaves already
    // issued invoices at the rate they were billed at.
    rate: client.rate ?? '',
  };
}

/** "00017" -> "00018", "INV-9" -> "INV-10". Left alone if there's no number. */
export function nextInvoiceNo(no: string): string {
  const m = no.trim().match(/^(.*?)(\d+)(\D*)$/);
  if (!m) return no;
  const [, prefix, digits, suffix] = m;
  const bumped = String(Number(digits) + 1).padStart(digits.length, '0');
  return `${prefix}${bumped}${suffix}`;
}
