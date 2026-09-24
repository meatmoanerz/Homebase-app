import assert from 'node:assert/strict'
import test from 'node:test'
// @ts-expect-error Node's native TypeScript runner requires the explicit extension.
import { parseBankCsv } from '../src/lib/import/bank-parsers.ts'

test('Amex parser keeps positive charges and negative refunds', () => {
  const csv = [
    'Date,Description,Card Member,Amount',
    '09/15/2026,EXAMPLE SHOP,TEST USER,"125,50"',
    '09/16/2026,REFUND EXAMPLE SHOP,TEST USER,"-25,00"',
  ].join('\n')

  const result = parseBankCsv(csv, 'Amex')

  assert.equal(result.errors.length, 0)
  assert.deepEqual(result.transactions.map((row) => row.amount), [125.5, -25])
  assert.equal(result.transactions[0].cardholder, 'Test')
})

test('Amex parser dynamically flips exports where charges are negative', () => {
  const csv = [
    'Datum,Beskrivning,Kortmedlem,Belopp',
    '09/15/2026,EXEMPELBUTIK,TEST USER,"-125,50"',
    '09/16/2026,ÅTERBETALNING EXEMPELBUTIK,TEST USER,"25,00"',
  ].join('\n')

  const result = parseBankCsv(csv, 'Amex')

  assert.equal(result.errors.length, 0)
  assert.deepEqual(result.transactions.map((row) => row.amount), [125.5, -25])
})

test('payments establish the sign but are excluded, even when refunds dominate', () => {
  const result = parseBankCsv('Date,Description,Amount\n09/15/2026,Payment Received,-1000\n09/16/2026,SHOP,-25\n09/17/2026,SHOP,-35\n09/18/2026,SHOP,10', 'Amex')
  assert.deepEqual(result.transactions.map((row) => row.amount), [-25, -35, 10])
  assert.equal(result.errors.length, 0)
})

test('ambiguous negative-only exports fail closed instead of converting refunds to purchases', () => {
  const result = parseBankCsv('Date,Description,Amount\n09/15/2026,SHOP,-25', 'Amex')
  assert.equal(result.transactions.length, 0)
  assert.ok(result.errors.length > 0)
})

test('invalid calendar dates are reported', () => {
  const result = parseBankCsv('Date,Description,Amount\n02/30/2026,SHOP,25\n99/99/2026,SHOP,10', 'Amex')
  assert.equal(result.transactions.length, 0)
  assert.equal(result.errors.length, 2)
})
