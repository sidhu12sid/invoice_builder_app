import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function load(path, dependencies = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(name => {
    if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}
const invoice = load('../lib/invoice.ts');
const { summarize, currencyKey, invoiceDate } = load('../lib/dashboard.ts', { './invoice': invoice });
const row = (patch = {}, status = 'final') => ({ id: '1', status, data: { ...invoice.defaultInvoice, invoiceDate: '05/09/2026', currencyCode: 'INR', rate: '100', clientCompany: 'Client', items: [{ billableHours: '2.5', workingHours: '3', price: '999' }], ...patch } });
const now = new Date(2026, 8, 6);

test('monthly totals exclude drafts and use invoice hourly rates', () => {
  const result = summarize([row(), row({}, 'draft'), row({}, 'sent')], now);
  assert.equal(result.total, 3);
  assert.equal(result.drafts, 1);
  assert.equal(result.months[5].invoiced, 500);
  assert.equal(result.hours, 5);
  assert.equal(result.clients[0].amount, 500);
});
test('payments use receipt month and partial payments accumulate', () => {
  const result = summarize([row({ invoiceDate: '01/08/2026', payments: [{ amount: 50, date: '2026-08-20' }, { amount: 100, date: '2026-09-01' }, { amount: 25, date: '2026-09-02' }] })], now);
  assert.equal(result.months[4].invoiced, 250);
  assert.equal(result.months[4].received, 50);
  assert.equal(result.months[5].received, 125);
  assert.equal(result.months[5].invoiced, 0);
});
test('invalid dates are excluded without shifting totals to the update month', () => {
  assert.equal(invoiceDate('31/02/2026'), null);
  assert.equal(invoiceDate(''), null);
  const result = summarize([row({ invoiceDate: '' })], now);
  assert.equal(result.undated, 1);
  assert.equal(result.months[5].invoiced, 0);
  assert.equal(result.clients[0].amount, 250);
});
test('currency codes and ambiguous legacy symbols remain separate', () => {
  assert.notEqual(currencyKey(row({ currencyCode: 'USD', currency: '$' }).data), currencyKey(row({ currencyCode: 'CAD', currency: '$' }).data));
  assert.notEqual(currencyKey(row({ currencyCode: undefined, currency: '$' }).data), 'USD');
});
test('six-month window crosses the year boundary with empty months preserved', () => {
  const result = summarize([], new Date(2026, 0, 1));
  assert.equal(result.months.length, 6);
  assert.equal(result.months[0].key, '2025-7');
  assert.equal(result.months[5].key, '2026-0');
});

test('monthly billable hours use invoice dates, exclude drafts, and preserve empty months', () => {
  const result = summarize([
    row({ invoiceDate: '01/04/2026' }),
    row({ invoiceDate: '31/08/2026' }, 'sent'),
    row(),
    row({}, 'draft'),
    row({ invoiceDate: '31/03/2026' }),
    row({ invoiceDate: '' }),
  ], now);
  assert.deepEqual(result.months.map(m => m.billableHours), [2.5, 0, 0, 0, 2.5, 2.5]);
  assert.equal(result.hours, result.months[5].billableHours);
  const mixed = [row(), row({ currencyCode: 'USD' })];
  assert.equal(summarize(mixed, now).months[5].billableHours, 5);
  assert.equal(summarize(mixed.filter(i => currencyKey(i.data) === 'INR'), now).months[5].billableHours, 2.5);
});
