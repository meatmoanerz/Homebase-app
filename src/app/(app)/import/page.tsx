'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { useCategories } from '@/hooks/use-categories'
import { useCreateExpense } from '@/hooks/use-expenses'
import { parseHomebaseCsv, getCsvTemplate, type CsvParseResult } from '@/lib/import/csv-parser'
import { formatCurrency } from '@/lib/utils/formatters'
import { useUser } from '@/hooks/use-user'
import { motion } from 'framer-motion'
import { Upload, FileText, CheckCircle2, AlertTriangle, Download, X, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'
import Link from 'next/link'

type Step = 'upload' | 'preview' | 'importing' | 'done'

export default function ImportPage() {
  const router = useRouter()
  const { data: user } = useUser()
  const { data: categories = [] } = useCategories()
  const createExpense = useCreateExpense()

  const [step, setStep] = useState<Step>('upload')
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [importProgress, setImportProgress] = useState(0)
  const [importedCount, setImportedCount] = useState(0)
  const [skipWarnings, setSkipWarnings] = useState(true)

  const categoryNames = categories.map((c) => c.name)
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]))

  const onDrop = useCallback(
    (files: File[]) => {
      const file = files[0]
      if (!file) return
      setFileName(file.name)
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        const result = parseHomebaseCsv(text, categoryNames)
        setParseResult(result)
        setStep('preview')
      }
      reader.readAsText(file)
    },
    [categoryNames]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'text/plain': ['.csv', '.txt'] },
    maxFiles: 1,
  })

  function downloadTemplate() {
    const blob = new Blob([getCsvTemplate()], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'homebase-import-mall.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport() {
    if (!parseResult || !user) return
    setStep('importing')

    const rowsToImport = skipWarnings
      ? parseResult.rows.filter((r) => r.warnings.length === 0)
      : parseResult.rows.filter((r) => r.date && r.description && r.amount !== 0)

    let imported = 0
    for (const row of rowsToImport) {
      const category = categoryByName.get(row.category.toLowerCase())

      try {
        await createExpense.mutateAsync({
          date: row.date,
          description: row.notes ? `${row.description} (${row.notes})` : row.description,
          amount: row.amount,
          category_id: category?.id ?? null,
          cost_assignment: row.costAssignment,
          is_ccm: row.onCreditCard,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        imported++
        setImportProgress(Math.round((imported / rowsToImport.length) * 100))
        setImportedCount(imported)
      } catch (err) {
        console.error('Import error for row', row.rowIndex, err)
      }
    }

    setStep('done')
    toast.success(`${imported} utgifter importerade`)
  }

  return (
    <div className="px-4 md:px-8 pt-2 md:pt-4 pb-4 space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="w-9 h-9 rounded-full grid place-items-center text-muted-foreground hover:bg-secondary transition-colors md:hidden"
        >
          <ArrowLeft className="w-[18px] h-[18px]" />
        </Link>
        <div>
          <h1 className="font-serif text-[24px] md:text-[32px] font-medium tracking-tight">
            Importera CSV
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ladda upp en standardiserad CSV-fil
          </p>
        </div>
      </div>

      {/* Step: Upload */}
      {step === 'upload' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors',
              isDragActive ? 'border-hb-cognac bg-hb-cognac/5' : 'border-border bg-card hover:border-hb-cognac/50'
            )}
          >
            <input {...getInputProps()} />
            <div className="w-14 h-14 mx-auto rounded-2xl bg-hb-cognac/10 grid place-items-center mb-4">
              <Upload className="w-7 h-7 text-hb-cognac" />
            </div>
            <p className="font-medium text-sm">
              {isDragActive ? 'Släpp filen här' : 'Dra hit en CSV-fil eller tryck för att välja'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Formatet ska följa Homebase-mallen
            </p>
          </div>

          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 text-sm text-hb-cognac-deep font-medium hover:underline mx-auto"
          >
            <Download className="w-4 h-4" />
            Ladda ner CSV-mall
          </button>

          <div className="bg-card border border-border rounded-2xl p-4 text-xs text-muted-foreground leading-relaxed">
            <p className="font-medium text-foreground mb-2">Så funkar det</p>
            <p>
              Be Claude i chatten att konvertera dina rå bank-CSV:er (SEB, Swedbank, Amex)
              till Homebase-formatet. Du får tillbaka en färdig CSV med kategorier och
              kostnadsdelning ifylld — ladda bara upp den här.
            </p>
          </div>
        </motion.div>
      )}

      {/* Step: Preview */}
      {step === 'preview' && parseResult && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Summary */}
          <div className="flex items-center justify-between bg-card border border-border rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileText className="w-5 h-5 text-hb-cognac flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{fileName}</div>
                <div className="text-xs text-muted-foreground">
                  {parseResult.rows.length} rader · {formatCurrency(parseResult.totalAmount)}
                </div>
              </div>
            </div>
            <button
              onClick={() => { setStep('upload'); setParseResult(null) }}
              className="w-8 h-8 rounded-full grid place-items-center text-muted-foreground hover:bg-secondary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Global errors */}
          {parseResult.globalErrors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 space-y-1">
              {parseResult.globalErrors.map((err, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-destructive">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  {err}
                </div>
              ))}
            </div>
          )}

          {/* Counts */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-success">
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-serif text-[20px] font-medium">{parseResult.validRowCount}</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">utan varningar</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-hb-amber">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-serif text-[20px] font-medium">{parseResult.warningRowCount}</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">med varningar</div>
            </div>
          </div>

          {/* Skip warnings toggle */}
          {parseResult.warningRowCount > 0 && (
            <label className="flex items-center gap-2.5 bg-card border border-border rounded-xl px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={skipWarnings}
                onChange={(e) => setSkipWarnings(e.target.checked)}
                className="w-4 h-4 accent-hb-cognac"
              />
              <span className="text-sm">Hoppa över rader med varningar vid import</span>
            </label>
          )}

          {/* Preview rows */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="max-h-80 overflow-y-auto">
              {parseResult.rows.map((row) => (
                <div
                  key={row.rowIndex}
                  className={cn(
                    'px-4 py-3 border-b border-border last:border-b-0',
                    row.warnings.length > 0 && 'bg-hb-amber/5'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{row.description || '(saknar beskrivning)'}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {row.date} · {row.category || 'ingen kategori'}
                        {row.bank && ` · ${row.bank}`}
                      </div>
                    </div>
                    <span className="font-serif text-[15px] font-medium flex-shrink-0">
                      {formatCurrency(row.amount)}
                    </span>
                  </div>
                  {row.warnings.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {row.warnings.map((w, i) => (
                        <span key={i} className="text-[10px] text-hb-amber bg-hb-amber/10 px-1.5 py-0.5 rounded-full">
                          {w}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Import button */}
          <button
            onClick={handleImport}
            disabled={parseResult.globalErrors.length > 0}
            className="w-full py-3 rounded-full bg-hb-nav text-hb-nav-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            Importera {skipWarnings ? parseResult.validRowCount : parseResult.rows.length} utgifter
          </button>
        </motion.div>
      )}

      {/* Step: Importing */}
      {step === 'importing' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-hb-cognac/10 grid place-items-center mb-4 animate-pulse">
            <Upload className="w-7 h-7 text-hb-cognac" />
          </div>
          <p className="font-medium text-sm mb-3">Importerar… {importedCount} klara</p>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden max-w-xs mx-auto">
            <div className="h-full bg-hb-cognac rounded-full transition-all" style={{ width: `${importProgress}%` }} />
          </div>
        </motion.div>
      )}

      {/* Step: Done */}
      {step === 'done' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-success/10 grid place-items-center mb-4">
            <CheckCircle2 className="w-7 h-7 text-success" />
          </div>
          <h2 className="font-serif text-xl font-medium mb-1">Klart!</h2>
          <p className="text-sm text-muted-foreground mb-5">
            {importedCount} utgifter har importerats
          </p>
          <div className="flex gap-2.5 justify-center">
            <button
              onClick={() => { setStep('upload'); setParseResult(null); setImportProgress(0); setImportedCount(0) }}
              className="px-4 py-2 rounded-full border border-border text-sm font-medium hover:bg-secondary transition-colors"
            >
              Importera fler
            </button>
            <button
              onClick={() => router.push('/expenses/list')}
              className="px-4 py-2 rounded-full bg-hb-nav text-hb-nav-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Visa utgifter
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
