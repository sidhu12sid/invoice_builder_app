'use client';

import {
  Invoice,
  formatAmount,
  formatHours,
  num,
  totals,
} from '@/lib/invoice';

/** Shows `value`, falling back to the template placeholder in grey. */
function V({ value, fallback }: { value: string; fallback: string }) {
  const text = value.trim();
  return text ? <>{text}</> : <span className="ph">{fallback}</span>;
}

export default function InvoicePreview({ data }: { data: Invoice }) {
  const t = totals(data.items);
  const cur = data.currency || '';

  return (
    <div className="sheet" id="invoice-sheet">
      <div className="inv__top">
        <div className="inv__from">
          <div className="inv__name">
            <V value={data.senderName} fallback="[Your Name]" />
          </div>
          <div className="inv__fromLine">
            <V value={data.senderAddress1} fallback="[Address Line 1]" />
          </div>
          <div className="inv__fromLine">
            <V
              value={data.senderAddress2}
              fallback="[Address Line 2, City, State PIN: 000000]"
            />
          </div>
          <div className="inv__fromLine">
            <V value={data.senderPhone} fallback="[+91 00000 00000]" />
          </div>
        </div>

        <div className="inv__meta">
          <div className="inv__title">INVOICE</div>
          <div className="inv__date">
            <V value={data.invoiceDate} fallback="[DD/MM/YYYY]" />
          </div>
          <div className="inv__metaRow">
            <b>INVOICE PERIOD:</b>{' '}
            <V value={data.invoicePeriod} fallback="[MMM YYYY]" />
          </div>
          <div className="inv__metaRow">
            <b>INVOICE NO.:</b> <V value={data.invoiceNo} fallback="[00000]" />
          </div>
        </div>
      </div>

      <div className="inv__rule" />

      <div className="sectionTitle">BILL TO</div>
      <table className="inv billTo">
        <tbody>
          <tr>
            <th>Company Name</th>
            <td>
              <V value={data.clientCompany} fallback="[Client Company Name]" />
            </td>
          </tr>
          <tr>
            <th>Address</th>
            <td>
              <V
                value={data.clientAddress}
                fallback="[Client Address, City, State, State Code: 00 PIN: 000000]"
              />
            </td>
          </tr>
          <tr>
            <th>Phone</th>
            <td>
              <V value={data.clientPhone} fallback="[+91 000 000 0000]" />
            </td>
          </tr>
          <tr>
            <th>Email</th>
            <td>
              <V value={data.clientEmail} fallback="[accounts@client.com]" />
            </td>
          </tr>
        </tbody>
      </table>

      <div className="spacer" />

      <div className="sectionTitle">TIMESHEET</div>
      <table className="inv">
        <thead>
          <tr>
            <th>TASK</th>
            <th>WORKING HOURS</th>
            <th>BILLABLE HOURS</th>
            <th>PRICE</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, i) => (
            <tr key={item.id}>
              <td>
                <V
                  value={item.reference}
                  fallback={`[TS-YYYY-${String(i + 1).padStart(5, '0')}]`}
                />
              </td>
              <td className="num">
                <V value={item.workingHours} fallback="[0]" />
              </td>
              <td className="num">
                <V value={item.billableHours} fallback="[0]" />
              </td>
              <td className="num">
                {item.price.trim() ? (
                  `${cur}${formatAmount(num(item.price))}`
                ) : (
                  <span className="ph">[0.00]</span>
                )}
              </td>
            </tr>
          ))}
          <tr className="totalRow">
            <td>Total</td>
            <td className="num">{formatHours(t.workingHours)}</td>
            <td className="num">{formatHours(t.billableHours)}</td>
            <td className="num">
              {cur}
              {formatAmount(t.price)}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="inv__foot">
        <div className="remarks">
          <div className="remarks__title">Remarks / Payment Instructions:</div>
          <div className="remarks__line">
            <b className="remarks__key">Account No.:</b>{' '}
            <V value={data.accountNo} fallback="[0000000000000000]" />
          </div>
          <div className="remarks__line">
            <b className="remarks__key">IFSC:</b>{' '}
            <V value={data.ifsc} fallback="[XXXX0000000]" />
          </div>
          <div className="remarks__line">
            <b className="remarks__key">PAN No.:</b>{' '}
            <V value={data.panNo} fallback="[XXXXX0000X]" />
          </div>
          {data.extraRemarks.trim() && (
            <div className="remarks__extra">{data.extraRemarks}</div>
          )}
        </div>

        <table className="summary">
          <tbody>
            <tr>
              <td className="label">SUBTOTAL</td>
              <td className="num">
                {cur}
                {formatAmount(t.price)}
              </td>
            </tr>
            <tr className="due">
              <td>Balance Due</td>
              <td className="num">
                {cur}
                {formatAmount(t.price)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
