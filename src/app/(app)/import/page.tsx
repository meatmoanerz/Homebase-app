'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { useCategories } from '@/hooks/use-categories'
import { useCreateExpense } from '@/hooks/use-expenses'
import { useCategoryMappings, findMatchingMapping, incrementMappingHit, useCreateMapping, suggestPatternFromDescription } from '@/hooks/use-category-mappings'
import { useAssignmentOptions } from '@/hooks/use-assignment-options'
import { parseHomebaseCsv, getCsvTemplate, type CsvParseResult } from '@/lib/import/csv-parser'
import { parseBankCsv, detectBank, decodeCsvBuffer, type BankParseResult } from '@/lib/import/bank-parsers'
import { formatCurrency } from '@/lib/utils/formatters'
import { useUser } from '@/hooks/use-user'
import { motion } from 'framer-motion'
import { Upload, FileText, CheckCircle2, AlertTriangle, Download, X, ArrowLeft, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'
import Link from 'next/link'

type ImportMode = 'homebase' | 'bank'
type Step = 'choose' | 'upload' | 'preview' | 'importing' | 'done'
type BankChoice = 'auto' | 'SEB' | 'Swedbank' | 'Amex'

interface PreviewRow {
  date: string
  description: string
  amount: number
  bank: string | null
  onCreditCard: boolean
  suggestedCategoryId: string | null
  suggestedCategoryName: string | null
  selectedCategoryId: string | null
  costAssignment: 'personal' | 'shared' | 'partner'
  mappingId: string | null
  warnings: string[]
  skip: boolean
}

export default function ImportPage() {
  const router = useRouter()
  const { data: user } = useUser()
  const { data: categories = [] } = useCategories()
  const { data: mappings = [] } = useCategoryMappings()
  const createExpense = useCreateExpense()
  const createMapping = useCreateMapping()
  const assignmentOptions = useAssignmentOptions()

  const [mode, setMode] = useState<ImportMode>('homebase')
  const [step, setStep] = useState<Step>('choose')
  const [bankChoice, setBankChoice] = useState<BankChoice>('auto')
  const [fileName, setFileName] = useState('')
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null)
  const [bankResult, setBankResult] = useState<BankParseResult | null>(null)
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [importProgress, setImportProgress] = useState(0)
  const [importedCount, setImportedCount] = useState(0)
  const [savedRuleRows, setSavedRuleRows] = useState<Set<number>>(new Set())
  const [parseError, setParseError] = useState<string | null>(null)

  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]))
  const categoryById = new Map(categories.map((c) => [c.id, c]))

  function processHomebaseUpload(text: string) {
    const result = parseHomebaseCsv(text, categories.map((c) => c.name))
    setParseResult(result)
    setBankResult(null)

    // Convert to preview rows
    const rows: PreviewRow[] = result.rows.map((r) => {
      const cat = categoryByName.get(r.category.toLowerCase())
      return {
        date: r.date,
        description: r.description,
        amount: r.amount,
        bank: r.bank || null,
        onCreditCard: r.onCreditCard,
        suggestedCategoryId: cat?.id ?? null,
        suggestedCategoryName: cat?.name ?? null,
        selectedCategoryId: cat?.id ?? null,
        costAssignment: r.costAssignment,
        mappingId: null,
        warnings: r.warnings,
        skip: r.warnings.length > 0,
      }
    })
    setPreviewRows(rows)
    setStep('preview')
  }

  function processBankUpload(text: string) {
    try {
      const result = parseBankCsv(text, bankChoice)
      setBankResult(result)
      setParseResult(null)

      // Apply category mappings to each transaction
      const rows: PreviewRow[] = result.transactions.map((tx) => {
        const match = findMatchingMapping(tx.description, mappings, tx.bank)
        const isAmex = tx.bank === 'Amex'

        return {
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          bank: tx.bank,
          onCreditCard: isAmex,
          suggestedCategoryId: match?.category_id ?? null,
          suggestedCategoryName: match?.category?.name ?? null,
          selectedCategoryId: match?.category_id ?? null,
          costAssignment: match?.cost_assignment ?? 'shared',
          mappingId: match?.id ?? null,
          warnings: !match ? ['Ingen automatisk kategorimatchning'] : [],
          skip: false,
        }
      })

      setPreviewRows(rows)
      setParseError(
        rows.length === 0
          ? `Hittade inga transaktioner i filen. Identifierat format: ${result.detectedBank}. ${result.errors.join(' ')} Kontrollera att rätt bank är vald.`
          : null
      )
      setStep('preview')
    } catch (err) {
      console.error('Bank parse error:', err)
      setParseError(`Kunde inte läsa filen: ${err instanceof Error ? err.message : 'okänt fel'}`)
      setStep('preview')
    }
  }

  const onDrop = useCallback(
    (files: File[]) => {
      const file = files[0]
      if (!file) return
      setFileName(file.name)
      setParseError(null)
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer
          const text = decodeCsvBuffer(buffer)
          if (mode === 'homebase') processHomebaseUpload(text)
          else processBankUpload(text)
        } catch (err) {
          console.error('File read error:', err)
          setParseError(`Kunde inte läsa filen: ${err instanceof Error ? err.message : 'okänt fel'}`)
          setStep('preview')
        }
      }
      reader.onerror = () => {
        setParseError('Filen kunde inte läsas. Försök igen.')
        setStep('preview')
      }
      reader.readAsArrayBuffer(file)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, categories, mappings, bankChoice]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    // No MIME restriction — iOS Safari often reports CSV as octet-stream/empty
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

  function updateRow(index: number, updates: Partial<PreviewRow>) {
    setPreviewRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...updates } : r)))
  }

  async function handleSaveRule(index: number) {
    const row = previewRows[index]
    if (!row || !row.selectedCategoryId) return

    const pattern = suggestPatternFromDescription(row.description)
    try {
      await createMapping.mutateAsync({
        pattern,
        category_id: row.selectedCategoryId,
        cost_assignment: row.costAssignment,
        match_type: 'contains',
        bank: row.bank,
        priority: 50,
        comment: `Skapad vid import från "${row.description}"`,
      })
      setSavedRuleRows((prev) => new Set(prev).add(index))
      toast.success(`Regel sparad: "${pattern}" → kategoriseras automatiskt framöver`)
    } catch (err) {
      console.error('Kunde inte spara regel:', err)
      toast.error('Kunde inte spara regeln')
    }
  }

  async function handleImport() {
    if (!user) return
    setStep('importing')

    const rowsToImport = previewRows.filter((r) => !r.skip && r.date && r.description && r.amount !== 0)

    let imported = 0
    for (const row of rowsToImport) {
      try {
        await createExpense.mutateAsync({
          date: row.date,
          description: row.description,
          amount: row.amount,
          category_id: row.selectedCategoryId,
          cost_assignment: row.costAssignment,
          is_ccm: row.onCreditCard,
          bank: row.bank,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        imported++

        // Fire-and-forget: bump hit_count if we used a mapping
        if (row.mappingId) {
          incrementMappingHit(row.mappingId).catch(() => {})
        }

        setImportProgress(Math.round((imported / rowsToImport.length) * 100))
        setImportedCount(imported)
      } catch (err) {
        console.error('Import error:', err)
      }
    }

    setStep('done')
    toast.success(`${imported} utgifter importerade`)
  }

  // Computed stats
  const totalRows = previewRows.length
  const matchedRows = previewRows.filter((r) => r.suggestedCategoryId).length
  const importableRows = previewRows.filter((r) => !r.skip).length
  const totalAmount = previewRows.filter((r) => !r.skip).reduce((s, r) => s + r.amount, 0)

  return (
    <div className="px-4 md:px-8 pt-2 md:pt-4 pb-4 space-y-5 max-w-3xl mx-auto">
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
            Importera transaktioner
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ladda upp en CSV-fil från din bank eller en färdig Homebase-fil
          </p>
        </div>
      </div>

      {/* Step: Choose mode */}
      {step === 'choose' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <ModeCard
            active={mode === 'bank'}
            onClick={() => setMode('bank')}
            title="Rå bankfil"
            description="Ladda ner CSV direkt från SEB, Swedbank eller Amex. Appen kategoriserar automatiskt med dina sparade regler."
            icon="🏦"
          />
          <ModeCard
            active={mode === 'homebase'}
            onClick={() => setMode('homebase')}
            title="Homebase-CSV"
            description="Färdig CSV-fil (t.ex. förberedd i Claude-chatten) med kategorier och kostnadsdelning ifyllda."
            icon="📋"
          />

          <button
            onClick={() => setStep('upload')}
            className="w-full py-3 rounded-full bg-hb-nav text-hb-nav-foreground font-medium text-sm hover:opacity-90 transition-opacity"
          >
            Fortsätt
          </button>
        </motion.div>
      )}

      {/* Step: Upload */}
      {step === 'upload' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <button
            onClick={() => setStep('choose')}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" />
            Byt importläge
          </button>

          {mode === 'bank' && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Vilken bank?
              </div>
              <div className="flex gap-1.5 bg-secondary rounded-full p-1">
                {(['auto', 'SEB', 'Swedbank', 'Amex'] as BankChoice[]).map((b) => (
                  <button
                    key={b}
                    onClick={() => setBankChoice(b)}
                    className={cn(
                      'flex-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                      bankChoice === b ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                    )}
                  >
                    {b === 'auto' ? 'Auto' : b}
                  </button>
                ))}
              </div>
            </div>
          )}

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
              {isDragActive ? 'Släpp filen här' : 'Dra hit CSV-filen eller tryck för att välja'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {mode === 'bank' ? 'Originalfil från banken' : 'Homebase standard-CSV'}
            </p>
          </div>

          {mode === 'homebase' && (
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 text-sm text-hb-cognac-deep font-medium hover:underline mx-auto"
            >
              <Download className="w-4 h-4" />
              Ladda ner CSV-mall
            </button>
          )}

          <div className="bg-card border border-border rounded-2xl p-4 text-xs text-muted-foreground leading-relaxed">
            {mode === 'bank' ? (
              <>
                <p className="font-medium text-foreground mb-2">Rå bankfil — så funkar det</p>
                <p>
                  Ladda ner transaktionerna som CSV direkt från din internetbank. Appen läser
                  varje rad, försöker kategorisera den automatiskt baserat på dina sparade regler,
                  och visar en förhandsgranskning där du kan justera innan import.
                </p>
                <p className="mt-2 flex items-center gap-1 text-hb-cognac-deep">
                  <Sparkles className="w-3 h-3" />
                  {mappings.length} regler tillgängliga för auto-kategorisering
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-foreground mb-2">Homebase-CSV — så funkar det</p>
                <p>
                  Be Claude i chatten att konvertera dina rå bank-CSV:er till Homebase-formatet.
                  Du får tillbaka en färdig CSV med kategorier och kostnadsdelning — ladda bara upp den här.
                </p>
              </>
            )}
          </div>
        </motion.div>
      )}

      {/* Step: Preview */}
      {/* Step: Preview — error / empty state */}
      {step === 'preview' && previewRows.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-5 text-center">
            <AlertTriangle className="w-7 h-7 text-destructive mx-auto mb-3" />
            <p className="font-medium text-sm mb-1">Inga transaktioner hittades</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {parseError || 'Filen kunde inte tolkas.'}
            </p>
          </div>
          <button
            onClick={() => {
              setStep('upload')
              setParseError(null)
              setPreviewRows([])
            }}
            className="w-full py-3 rounded-full bg-hb-nav text-hb-nav-foreground font-medium text-sm hover:opacity-90 transition-opacity"
          >
            Försök igen
          </button>
        </motion.div>
      )}

      {step === 'preview' && previewRows.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* File summary */}
          <div className="flex items-center justify-between bg-card border border-border rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileText className="w-5 h-5 text-hb-cognac flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{fileName}</div>
                <div className="text-xs text-muted-foreground">
                  {totalRows} rader · {bankResult?.detectedBank || 'Homebase'} · {formatCurrency(totalAmount)}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setStep('upload')
                setParseResult(null)
                setBankResult(null)
                setPreviewRows([])
              }}
              className="w-8 h-8 rounded-full grid place-items-center text-muted-foreground hover:bg-secondary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <StatCard label="Att importera" value={importableRows} accent="default" />
            <StatCard
              label="Auto-kategoriserade"
              value={matchedRows}
              accent={matchedRows === totalRows ? 'success' : 'default'}
            />
            <StatCard
              label="Behöver granskning"
              value={totalRows - matchedRows}
              accent={totalRows - matchedRows > 0 ? 'warn' : 'success'}
            />
          </div>

          {/* Errors */}
          {parseResult?.globalErrors && parseResult.globalErrors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 space-y-1">
              {parseResult.globalErrors.map((err, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-destructive">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  {err}
                </div>
              ))}
            </div>
          )}

          {/* Preview rows with inline edit */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="max-h-[60vh] overflow-y-auto">
              {previewRows.map((row, idx) => (
                <PreviewRowItem
                  key={idx}
                  row={row}
                  categories={categories}
                  categoryById={categoryById}
                  onUpdate={(updates) => updateRow(idx, updates)}
                  onSaveRule={() => handleSaveRule(idx)}
                  ruleSaved={savedRuleRows.has(idx)}
                  showSaveRule={mode === 'bank'}
                  assignmentOptions={assignmentOptions}
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleImport}
            disabled={importableRows === 0}
            className="w-full py-3 rounded-full bg-hb-nav text-hb-nav-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            Importera {importableRows} utgifter
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
              onClick={() => {
                setStep('choose')
                setParseResult(null)
                setBankResult(null)
                setPreviewRows([])
                setImportProgress(0)
                setImportedCount(0)
              }}
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

function ModeCard({
  active,
  onClick,
  title,
  description,
  icon,
}: {
  active: boolean
  onClick: () => void
  title: string
  description: string
  icon: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full bg-card border-2 rounded-2xl p-4 text-left transition-all',
        active ? 'border-hb-cognac shadow-md' : 'border-border hover:border-hb-cognac/40'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="font-serif text-[16px] font-medium tracking-tight">{title}</div>
          <div className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{description}</div>
        </div>
        {active && (
          <div className="w-5 h-5 rounded-full bg-hb-cognac grid place-items-center flex-shrink-0">
            <CheckCircle2 className="w-3 h-3 text-card" />
          </div>
        )}
      </div>
    </button>
  )
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: 'default' | 'success' | 'warn' }) {
  const color =
    accent === 'success'
      ? 'text-success'
      : accent === 'warn'
        ? 'text-hb-amber'
        : 'text-foreground'

  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground font-semibold">
        {label}
      </div>
      <div className={cn('font-serif text-[22px] font-medium mt-1', color)}>{value}</div>
    </div>
  )
}

function PreviewRowItem({
  row,
  categories,
  categoryById,
  onUpdate,
  onSaveRule,
  ruleSaved,
  showSaveRule,
  assignmentOptions,
}: {
  row: PreviewRow
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  categories: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  categoryById: Map<string, any>
  onUpdate: (updates: Partial<PreviewRow>) => void
  onSaveRule: () => void
  ruleSaved: boolean
  showSaveRule: boolean
  assignmentOptions: { value: 'personal' | 'shared' | 'partner'; label: string }[]
}) {
  // Show "save as rule" when: bank mode, no auto-match existed, user picked a category
  const canSaveRule =
    showSaveRule && !row.suggestedCategoryId && !!row.selectedCategoryId && !ruleSaved

  return (
    <div
      className={cn(
        'px-4 py-3 border-b border-border last:border-b-0',
        row.skip && 'opacity-50',
        row.warnings.length > 0 && 'bg-hb-amber/5'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{row.description || '(saknar)'}</div>
          <div className="text-[11px] text-muted-foreground">
            {row.date}
            {row.bank && ` · ${row.bank}`}
            {row.onCreditCard && ' · Amex'}
          </div>
        </div>
        <span className="font-serif text-[15px] font-medium flex-shrink-0">
          {formatCurrency(row.amount)}
        </span>
      </div>

      {/* Inline category + assignment edit */}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <select
          value={row.selectedCategoryId || ''}
          onChange={(e) => onUpdate({ selectedCategoryId: e.target.value || null })}
          className="text-[11px] bg-secondary border border-border rounded-full px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-hb-cognac"
        >
          <option value="">— ingen kategori —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={row.costAssignment}
          onChange={(e) =>
            onUpdate({ costAssignment: e.target.value as 'personal' | 'shared' | 'partner' })
          }
          className="text-[11px] bg-secondary border border-border rounded-full px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-hb-cognac"
        >
          {assignmentOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <label className="text-[11px] text-muted-foreground flex items-center gap-1 cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={row.skip}
            onChange={(e) => onUpdate({ skip: e.target.checked })}
            className="w-3 h-3 accent-hb-cognac"
          />
          Hoppa över
        </label>
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

      {canSaveRule && (
        <button
          onClick={onSaveRule}
          className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-hb-cognac-deep bg-hb-cognac/10 hover:bg-hb-cognac/20 transition-colors rounded-full px-2.5 py-1"
        >
          <Sparkles className="w-3 h-3" />
          Spara som regel för framtiden
        </button>
      )}

      {ruleSaved && (
        <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-success">
          <CheckCircle2 className="w-3 h-3" />
          Regel sparad
        </div>
      )}
    </div>
  )
}
