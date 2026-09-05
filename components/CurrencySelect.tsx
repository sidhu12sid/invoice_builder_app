import type { Currency } from '@/lib/currencies';

export default function CurrencySelect({ currencies, symbol, code, onChange }: {
  currencies: Currency[]; symbol: string; code?: string;
  onChange: (currency: Currency) => void;
}) {
  const symbolMatches = currencies.filter(c => c.symbol === symbol);
  const match = code ? currencies.find(c => c.code === code && c.symbol === symbol)
    : symbolMatches.length === 1 ? symbolMatches[0] : undefined;
  return <label className="field"><span>Currency</span>
    <select value={match ? match.code : '__saved'} onChange={event => {
      const picked = currencies.find(c => c.code === event.target.value);
      if (picked) onChange(picked);
    }}>
      {!match && <option value="__saved">{code ? `${code} — ` : ''}{symbol || 'Choose a currency'} (current)</option>}
      {currencies.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name} ({c.symbol})</option>)}
    </select>
    {!currencies.length && <small>Add your currencies in the Currencies section.</small>}
  </label>;
}
