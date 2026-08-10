'use client';

import {
  Invoice,
  LineItem,
  emptyItem,
  formatAmount,
  hasRate,
  lineAmount,
} from '@/lib/invoice';
import { Client } from '@/lib/clients';

type Props = {
  data: Invoice;
  onChange: (patch: Partial<Invoice>) => void;
  clients: Client[];
  onPickClient: (client: Client) => void;
};

function Text({
  label,
  value,
  placeholder,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export default function InvoiceForm({
  data,
  onChange,
  clients,
  onPickClient,
}: Props) {
  const rateSet = hasRate(data.rate);

  const setItem = (id: string, patch: Partial<LineItem>) =>
    onChange({
      items: data.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    });

  const addItem = () => onChange({ items: [...data.items, emptyItem()] });

  const removeItem = (id: string) =>
    onChange({ items: data.items.filter((it) => it.id !== id) });

  return (
    <div>
      <fieldset className="fieldset">
        <legend>From</legend>
        <Text
          label="Your name"
          value={data.senderName}
          placeholder="Your Name"
          onChange={(v) => onChange({ senderName: v })}
        />
        <Text
          label="Address line 1"
          value={data.senderAddress1}
          placeholder="Address Line 1"
          onChange={(v) => onChange({ senderAddress1: v })}
        />
        <Text
          label="Address line 2"
          value={data.senderAddress2}
          placeholder="City, State PIN: 000000"
          onChange={(v) => onChange({ senderAddress2: v })}
        />
        <Text
          label="Phone"
          value={data.senderPhone}
          placeholder="+91 00000 00000"
          onChange={(v) => onChange({ senderPhone: v })}
        />
      </fieldset>

      <fieldset className="fieldset">
        <legend>Invoice details</legend>
        <div className="grid2">
          <Text
            label="Invoice date"
            value={data.invoiceDate}
            placeholder="DD/MM/YYYY"
            onChange={(v) => onChange({ invoiceDate: v })}
          />
          <Text
            label="Invoice no."
            value={data.invoiceNo}
            placeholder="00000"
            onChange={(v) => onChange({ invoiceNo: v })}
          />
        </div>
        <div className="grid2">
          <Text
            label="Invoice period"
            value={data.invoicePeriod}
            placeholder="MMM YYYY"
            onChange={(v) => onChange({ invoicePeriod: v })}
          />
          <Text
            label="Currency symbol"
            value={data.currency}
            placeholder="₹"
            onChange={(v) => onChange({ currency: v })}
          />
        </div>

        <label className="field">
          <span>Hourly rate</span>
          <input
            inputMode="decimal"
            value={data.rate}
            placeholder="Leave blank to enter prices by hand"
            onChange={(e) => onChange({ rate: e.target.value })}
          />
        </label>
        <p className="hint hint--tight">
          {rateSet
            ? 'Each line’s price is billable hours × rate.'
            : 'Set a rate on a client and it fills in here automatically.'}
        </p>
      </fieldset>

      <fieldset className="fieldset">
        <legend>Bill to</legend>

        <label className="field">
          <span>Client</span>
          <select
            value={clients.find((c) => c.name === data.clientCompany)?.id ?? ''}
            disabled={clients.length === 0}
            onChange={(e) => {
              const picked = clients.find((c) => c.id === e.target.value);
              if (picked) onPickClient(picked);
            }}
          >
            <option value="">
              {clients.length
                ? 'Choose a client…'
                : 'No saved clients yet'}
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <p className="hint hint--tight">
          {clients.length
            ? 'Picking a client fills the four fields below.'
            : 'Add clients under “Clients” in the sidebar to pick them here.'}
        </p>

        <Text
          label="Company name"
          value={data.clientCompany}
          placeholder="Client Company Name"
          onChange={(v) => onChange({ clientCompany: v })}
        />
        <Text
          label="Address"
          value={data.clientAddress}
          placeholder="City, State, State Code: 00 PIN: 000000"
          onChange={(v) => onChange({ clientAddress: v })}
        />
        <div className="grid2">
          <Text
            label="Phone"
            value={data.clientPhone}
            placeholder="+91 000 000 0000"
            onChange={(v) => onChange({ clientPhone: v })}
          />
          <Text
            label="Email"
            value={data.clientEmail}
            placeholder="accounts@client.com"
            onChange={(v) => onChange({ clientEmail: v })}
          />
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend>Timesheet</legend>

        {data.items.map((item, i) => (
          <div className="item" key={item.id}>
            <div className="item__head">
              <span className="item__index">Line {i + 1}</span>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => removeItem(item.id)}
                disabled={data.items.length === 1}
              >
                Remove
              </button>
            </div>

            <label className="field">
              <span>Task / reference</span>
              <input
                value={item.reference}
                placeholder={`TS-YYYY-${String(i + 1).padStart(5, '0')}`}
                onChange={(e) => setItem(item.id, { reference: e.target.value })}
              />
            </label>

            <div className="grid3">
              <label className="field">
                <span>Working hrs</span>
                <input
                  inputMode="decimal"
                  value={item.workingHours}
                  placeholder="0"
                  onChange={(e) =>
                    setItem(item.id, { workingHours: e.target.value })
                  }
                />
              </label>
              <label className="field">
                <span>Billable hrs</span>
                <input
                  inputMode="decimal"
                  value={item.billableHours}
                  placeholder="0"
                  onChange={(e) =>
                    setItem(item.id, { billableHours: e.target.value })
                  }
                />
              </label>
              <label className="field">
                <span>{rateSet ? 'Price (auto)' : 'Price'}</span>
                {rateSet ? (
                  <input
                    readOnly
                    tabIndex={-1}
                    className="input--derived"
                    value={formatAmount(lineAmount(item, data.rate))}
                    title="Billable hours × rate"
                  />
                ) : (
                  <input
                    inputMode="decimal"
                    value={item.price}
                    placeholder="0.00"
                    onChange={(e) => setItem(item.id, { price: e.target.value })}
                  />
                )}
              </label>
            </div>
          </div>
        ))}

        <button type="button" className="btn btn--ghost" onClick={addItem}>
          + Add line
        </button>
        <p className="hint">
          Totals, subtotal and balance due are calculated automatically.
        </p>
      </fieldset>

      <fieldset className="fieldset">
        <legend>Payment instructions</legend>
        <Text
          label="Account no."
          value={data.accountNo}
          placeholder="0000000000000000"
          onChange={(v) => onChange({ accountNo: v })}
        />
        <div className="grid2">
          <Text
            label="IFSC"
            value={data.ifsc}
            placeholder="XXXX0000000"
            onChange={(v) => onChange({ ifsc: v })}
          />
          <Text
            label="PAN no."
            value={data.panNo}
            placeholder="XXXXX0000X"
            onChange={(v) => onChange({ panNo: v })}
          />
        </div>
        <label className="field">
          <span>Additional remarks (optional)</span>
          <textarea
            value={data.extraRemarks}
            placeholder="Payment due within 15 days…"
            onChange={(e) => onChange({ extraRemarks: e.target.value })}
          />
        </label>
      </fieldset>
    </div>
  );
}
