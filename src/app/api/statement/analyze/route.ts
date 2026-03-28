import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { getBankConfig } from '@/lib/statement/bank-configs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

interface SebTransaction {
  date: string
  description: string
  amount: number
}

function parseSebCsv(csvContent: string): SebTransaction[] {
  const lines = csvContent.trim().split('\n')
  // Skip header row
  const dataLines = lines.slice(1)

  const transactions: SebTransaction[] = []

  for (const line of dataLines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const cols = trimmed.split(';')
    if (cols.length < 5) continue

    const date = cols[0]          // Bokföringsdatum (YYYY-MM-DD)
    const description = cols[3]   // Text
    const rawAmount = cols[4]     // Belopp (e.g. -260.000)

    const amount = parseFloat(rawAmount)
    if (isNaN(amount) || amount >= 0) continue // Only expenses (negative amounts)

    transactions.push({
      date,
      description: description.trim(),
      amount: Math.round(Math.abs(amount) * 100) / 100,
    })
  }

  // Sort by date ascending
  transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return transactions
}

interface SwedbankTransaction {
  date: string
  description: string
  amount: number
}

function stripQuotes(s: string): string {
  const trimmed = s.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function parseSwedbankCsv(csvContent: string): SwedbankTransaction[] {
  const lines = csvContent.replace(/\r\n/g, '\n').trim().split('\n')
  // Skip row 1 (metadata) and row 2 (header) — data starts at row 3
  const dataLines = lines.slice(2)

  const transactions: SwedbankTransaction[] = []

  for (const line of dataLines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const cols = trimmed.split(',')
    if (cols.length < 11) continue

    const date = stripQuotes(cols[6])            // Transaktionsdag (YYYY-MM-DD)
    const description = stripQuotes(cols[9])     // Beskrivning
    const rawAmount = stripQuotes(cols[10])      // Belopp (e.g. -1952.80)

    const amount = parseFloat(rawAmount)
    if (isNaN(amount) || amount >= 0) continue // Only expenses (negative amounts)

    transactions.push({
      date,
      description,
      amount: Math.round(Math.abs(amount) * 100) / 100,
    })
  }

  // Sort by date ascending
  transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return transactions
}

interface AmexCsvTransaction {
  date: string
  description: string
  amount: number
}

function parseAmexCsv(csvContent: string): { transactions: AmexCsvTransaction[], invoiceTotal: number | null } {
  const lines = csvContent.replace(/\r\n/g, '\n').trim().split('\n')
  // Skip header row
  const dataLines = lines.slice(1)

  const transactions: AmexCsvTransaction[] = []
  let invoiceTotal: number | null = null

  for (const line of dataLines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const cols = trimmed.split(',')
    if (cols.length < 3) continue

    const dateCol = cols[0].trim()
    const descCol = cols[1].trim()
    const amountCol = cols[2].trim()

    // Skip summary rows (date column is empty)
    if (!dateCol) {
      // Try to extract invoice total from summary rows
      if (descCol === 'Fakturans saldo (kontroll)' || descCol === 'SUMMA') {
        const parsed = parseFloat(amountCol)
        if (!isNaN(parsed) && invoiceTotal === null) {
          invoiceTotal = parsed
        }
      }
      continue
    }

    const amount = parseFloat(amountCol)
    if (isNaN(amount)) continue

    transactions.push({
      date: dateCol,
      description: descCol,
      amount,
    })
  }

  // Sort by date ascending
  transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return { transactions, invoiceTotal }
}

interface ParsedTransaction {
  transaction_date: string
  process_date: string
  description: string
  amount: number
  cardholder?: string
  section: 'payments' | 'purchases'
  raw_row?: string
  // Legacy fields for backwards compatibility with old prompt format
  date?: string
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const bankId = formData.get('bankId') as string
    const userId = formData.get('userId') as string

    if (!file || !bankId || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const bankConfig = getBankConfig(bankId)
    if (!bankConfig) {
      return NextResponse.json({ error: 'Unknown bank' }, { status: 400 })
    }

    const { data: analysis, error: analysisError } = await supabaseAdmin
      .from('statement_analyses')
      .insert({
        user_id: userId,
        file_name: file.name,
        file_type: file.name.endsWith('.pdf') ? 'PDF' : 'CSV',
        bank_name: bankConfig.name,
        status: 'processing',
        transaction_count: 0,
      })
      .select()
      .single()

    if (analysisError) throw analysisError

    const isPdf = file.name.toLowerCase().endsWith('.pdf')
    const isCsv = file.name.toLowerCase().endsWith('.csv')

    // SEB CSV: parse directly without AI
    if (bankId === 'seb' && isCsv) {
      const fileContent = await file.text()
      console.log(`Processing SEB CSV: ${file.name}, length: ${fileContent.length} chars`)

      const sebTransactions = parseSebCsv(fileContent)
      console.log(`SEB CSV parsed: ${sebTransactions.length} expense transactions`)

      if (sebTransactions.length > 0) {
        const transactionRows = sebTransactions.map((t) => ({
          analysis_id: analysis.id,
          date: t.date,
          description: t.description,
          amount: t.amount,
          cardholder: null,
          cost_assignment: 'personal' as const,
          is_expense: true,
          is_saved: false,
          suggested_category_id: null,
          confirmed_category_id: null,
        }))

        await supabaseAdmin
          .from('statement_transactions')
          .insert(transactionRows)
      }

      await supabaseAdmin
        .from('statement_analyses')
        .update({
          status: 'completed',
          transaction_count: sebTransactions.length,
          invoice_total: null,
        })
        .eq('id', analysis.id)

      const calculatedSum = sebTransactions.reduce((sum, t) => sum + t.amount, 0)

      return NextResponse.json({
        success: true,
        analysisId: analysis.id,
        transactionCount: sebTransactions.length,
        invoiceTotal: null,
        calculatedSum: parseFloat(calculatedSum.toFixed(2)),
      })
    }

    // Swedbank CSV: parse directly without AI
    if (bankId === 'swedbank' && isCsv) {
      // Swedbank exports as Windows-1252/Latin-1 encoding
      const buffer = Buffer.from(await file.arrayBuffer())
      const fileContent = new TextDecoder('windows-1252').decode(buffer)
      console.log(`Processing Swedbank CSV: ${file.name}, length: ${fileContent.length} chars`)

      const swedbankTransactions = parseSwedbankCsv(fileContent)
      console.log(`Swedbank CSV parsed: ${swedbankTransactions.length} expense transactions`)

      if (swedbankTransactions.length > 0) {
        const transactionRows = swedbankTransactions.map((t) => ({
          analysis_id: analysis.id,
          date: t.date,
          description: t.description,
          amount: t.amount,
          cardholder: null,
          cost_assignment: 'personal' as const,
          is_expense: true,
          is_saved: false,
          suggested_category_id: null,
          confirmed_category_id: null,
        }))

        await supabaseAdmin
          .from('statement_transactions')
          .insert(transactionRows)
      }

      await supabaseAdmin
        .from('statement_analyses')
        .update({
          status: 'completed',
          transaction_count: swedbankTransactions.length,
          invoice_total: null,
        })
        .eq('id', analysis.id)

      const calculatedSum = swedbankTransactions.reduce((sum, t) => sum + t.amount, 0)

      return NextResponse.json({
        success: true,
        analysisId: analysis.id,
        transactionCount: swedbankTransactions.length,
        invoiceTotal: null,
        calculatedSum: parseFloat(calculatedSum.toFixed(2)),
      })
    }

    // Amex CSV: parse directly without AI
    if (bankId === 'amex' && isCsv) {
      const fileContent = await file.text()
      console.log(`Processing Amex CSV: ${file.name}, length: ${fileContent.length} chars`)

      const { transactions: amexTransactions, invoiceTotal: amexInvoiceTotal } = parseAmexCsv(fileContent)
      console.log(`Amex CSV parsed: ${amexTransactions.length} transactions, invoice total: ${amexInvoiceTotal}`)

      if (amexTransactions.length > 0) {
        const transactionRows = amexTransactions.map((t) => ({
          analysis_id: analysis.id,
          date: t.date,
          description: t.description,
          amount: Math.abs(t.amount),
          cardholder: null,
          cost_assignment: 'shared' as const,
          is_expense: t.amount >= 0,
          is_saved: false,
          suggested_category_id: null,
          confirmed_category_id: null,
        }))

        await supabaseAdmin
          .from('statement_transactions')
          .insert(transactionRows)
      }

      await supabaseAdmin
        .from('statement_analyses')
        .update({
          status: 'completed',
          transaction_count: amexTransactions.length,
          invoice_total: amexInvoiceTotal,
        })
        .eq('id', analysis.id)

      const calculatedSum = amexTransactions.reduce((sum, t) => sum + t.amount, 0)

      return NextResponse.json({
        success: true,
        analysisId: analysis.id,
        transactionCount: amexTransactions.length,
        invoiceTotal: amexInvoiceTotal,
        calculatedSum: parseFloat(calculatedSum.toFixed(2)),
      })
    }

    let completion

    if (isPdf) {
      const buffer = Buffer.from(await file.arrayBuffer())

      const base64 = buffer.toString('base64')
      console.log(`Processing PDF natively: ${file.name}, size: ${buffer.byteLength} bytes`)

      completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: bankConfig.prompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analysera detta kontoutdrag och extrahera alla transaktioner enligt instruktionerna. Returnera svaret som JSON.'
              },
              {
                type: 'file',
                file: {
                  filename: file.name,
                  file_data: `data:application/pdf;base64,${base64}`
                }
              }
            ]
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 8192
      })

      console.log('OpenAI PDF analysis completed')
    } else {
      // For CSV files, send as text
      const fileContent = await file.text()
      console.log(`Processing CSV: ${file.name}, length: ${fileContent.length} chars`)

      completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: bankConfig.prompt
          },
          {
            role: 'user',
            content: `Här är kontoutdraget:\n\n${fileContent}`
          }
        ],
        response_format: { type: 'json_object' }
      })
    }

    const rawContent = completion.choices[0].message.content || '{}'
    console.log('OpenAI raw response length:', rawContent.length)

    const result = JSON.parse(rawContent)
    const transactions: ParsedTransaction[] = result.transactions || []
    const invoiceTotal: number | null = result.invoice_total ?? null

    // Log extended validation from new prompt format
    if (result.checks) {
      console.log('Validation checks:', JSON.stringify(result.checks, null, 2))
    }
    if (result.parsing_warnings?.length > 0) {
      console.log('Parsing warnings:', JSON.stringify(result.parsing_warnings, null, 2))
    }

    // Filter out payments (credit card payments are not expenses to import)
    // Only keep purchases. Fall back to all transactions if section field is missing (legacy format)
    const hasSection = transactions.some(t => t.section)
    const purchaseTransactions = hasSection
      ? transactions.filter(t => t.section === 'purchases')
      : transactions

    // Sort by date (ascending - oldest first)
    const sortedTransactions = [...purchaseTransactions].sort((a, b) => {
      const dateA = a.transaction_date || a.date || ''
      const dateB = b.transaction_date || b.date || ''
      return new Date(dateA).getTime() - new Date(dateB).getTime()
    })

    // Calculate sum for verification
    const calculatedSum = sortedTransactions.reduce((sum, t) => sum + t.amount, 0)

    console.log(`Transactions found: ${sortedTransactions.length} (purchases only, filtered from ${transactions.length} total)`)
    console.log(`Invoice total from PDF: ${invoiceTotal}`)
    console.log(`Calculated sum (purchases): ${calculatedSum.toFixed(2)}`)
    if (result.new_purchases_total) {
      const diff = Math.abs(result.new_purchases_total - calculatedSum)
      console.log(`Diff vs new_purchases_total: ${diff.toFixed(2)} (${diff < 1 ? '✓ OK' : '⚠ MISMATCH'})`)
    }

    // Log first 5 transactions for debugging
    console.log('First 5 transactions:')
    sortedTransactions.slice(0, 5).forEach((t, i) => {
      const date = t.transaction_date || t.date
      console.log(`  ${i + 1}. ${date} | ${t.description} | ${t.amount} | ${t.cardholder?.split(' ')[0]}`)
    })

    if (sortedTransactions.length > 0) {
      const transactionRows = sortedTransactions.map((t) => ({
        analysis_id: analysis.id,
        date: t.transaction_date || t.date,
        description: t.description,
        amount: t.amount,
        cardholder: t.cardholder || null,
        cost_assignment: 'shared' as const,
        is_expense: t.amount >= 0,
        is_saved: false,
        suggested_category_id: null,
        confirmed_category_id: null,
      }))

      await supabaseAdmin
        .from('statement_transactions')
        .insert(transactionRows)

      await supabaseAdmin
        .from('statement_analyses')
        .update({
          status: 'completed',
          transaction_count: sortedTransactions.length,
          invoice_total: invoiceTotal
        })
        .eq('id', analysis.id)
    } else {
      await supabaseAdmin
        .from('statement_analyses')
        .update({
          status: 'completed',
          invoice_total: invoiceTotal
        })
        .eq('id', analysis.id)
    }

    return NextResponse.json({
      success: true,
      analysisId: analysis.id,
      transactionCount: sortedTransactions.length,
      invoiceTotal,
      calculatedSum: parseFloat(calculatedSum.toFixed(2))
    })

  } catch (error) {
    console.error('Statement analysis error:', error)
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json({
      error: 'Failed to analyze statement',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
