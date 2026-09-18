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
