import assert from 'node:assert/strict'
import test from 'node:test'
// @ts-expect-error Node's native TypeScript runner requires the explicit extension.
import { findStaleBanks } from '../src/lib/import/freshness.ts'

// "Today" is the 23rd at noon local time
const today = new Date(2026, 10, 23, 12, 0)
const upload = (day: number, hour = 18) => new Date(2026, 10, day, hour, 0).toISOString()

test('a file through the 21st on the 23rd is missing the 22nd', () => {
  const stale = findStaleBanks([{ user_id: 'tim', bank: 'Swedbank', latest_date: '2026-11-21', last_upload: upload(21) }], today)
  assert.deepEqual(stale, [{ userId: 'tim', bank: 'Swedbank', coveredThrough: '2026-11-21', missingFrom: '2026-11-22' }])
})

test('transactions through yesterday are up to date', () => {
  assert.deepEqual(findStaleBanks([{ user_id: 'tim', bank: 'SEB', latest_date: '2026-11-22', last_upload: upload(22) }], today), [])
})

test('a quiet card uploaded today is up to date though its latest purchase is old', () => {
  assert.deepEqual(findStaleBanks([{ user_id: 'tim', bank: 'Amex', latest_date: '2026-11-15', last_upload: upload(23, 9) }], today), [])
})

test('an upload yesterday covers the day before it only', () => {
  const stale = findStaleBanks([{ user_id: 'tim', bank: 'Amex', latest_date: '2026-11-20', last_upload: upload(22) }], today)
  assert.equal(stale[0]?.coveredThrough, '2026-11-21')
})

test('a bank with no file in 45 days counts as not in use', () => {
  assert.deepEqual(findStaleBanks([{ user_id: 'amanda', bank: 'Norwegian', latest_date: '2026-09-01', last_upload: upload(1).replace('2026-11', '2026-09') }], today), [])
})

test('oldest gap first, both partners listed', () => {
  const stale = findStaleBanks([
    { user_id: 'tim', bank: 'Swedbank', latest_date: '2026-11-20', last_upload: upload(20) },
    { user_id: 'amanda', bank: 'SEB', latest_date: '2026-11-10', last_upload: upload(10) },
  ], today)
  assert.deepEqual(stale.map((s: { userId: string }) => s.userId), ['amanda', 'tim'])
})
