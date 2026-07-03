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
import { useImportBatches, useStagingRows, useUpdateStagingRow, useToggleBatchPin, useDeleteBatch, type StagingBatch, type StagingRow } from '@/hooks/use-import-staging'
import { usePartner } from '@/hooks/use-user'
import { UtlaggSplitDialog, type UtlaggSplit } from '@/components/ccm/utlagg-dialog'
import { deriveCostAssignment } from '@/hooks/use-utlagg'
import { CategoryCombobox } from '@/components/import/category-combobox'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, CheckCircle2, AlertTriangle, Download, X, ArrowLeft, Sparkles, Pin, PinOff, Trash2, Clock, ChevronRight, Loader2, HandCoins } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'
import Link from 'next/link'

type ImportMode = 'homebase' | 'bank' | 'ai'
type Step = 'choose' | 'upload' | 'preview' | 'importing' | 'done' | 'ai-batches' | 'ai-review'
type BankChoice = 'auto' | 'SEB' | 'Swedbank' | 'Amex'

interface PreviewRow {
  date: string
  description: string
  amount: number
  bank: string | null
  onCreditCard: boolean
  cardholder?: string | null
  suggestedCategoryId: string | null
  suggestedCategoryName: string | null
  selectedCategoryId: string | null
  costAssignment: 'personal' | 'shared' | 'partner'
  mappingId: string | null
  warnings: string[]
  skip: boolean
  utlagg: UtlaggSplit | null
}

export default function ImportPage() {
  const router = useRouter()
  const { data: user } = useUser()
  const { data: partner } = usePartner()
  const { data: categories = [] } = useCategories()
  const { data: mappings = [] } = useCategoryMappings()
  const createExpense = useCreateExpense()
  const createMapping = useCreateMapping()
  const assignmentOptions = useAssignmentOptions()

  // AI-import hooks
  const { data: batches = [], isLoading: batchesLoading } = useImportBatches()
  const updateStagingRow = useUpdateStagingRow()
  const togglePin = useToggleBatchPin()
  const deleteBatch = useDeleteBatch()

  const [mode, setMode] = useState<ImportMode>('bank')
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

  // AI-import state
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null)
  const { data: stagingRows = [], isLoading: stagingLoading } = useStagingRows(activeBatchId)
  const [stagingEdits, setStagingEdits] = useState<Record<number, Partial<StagingRow>>>({})
  const [importingStaging, setImportingStaging] = useState(false)
  // Multi-select (bulk categorize) state
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<number>>(new Set())
  const [bulkCategoryId, setBulkCategoryId] = useState<string | null>(null)
  // Utlägg split dialog: which row is being edited
  const [splitTarget, setSplitTarget] = useState<
    { kind: 'preview'; index: number } | { kind: 'staging'; id: number } | null
  >(null)

  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]))
  const categoryById = new Map(categories.map((c) => [c.id, c]))

  function processHomebaseUpload(text: string) {
    const result = parseHomebaseCsv(text, categories.map((c) => c.name))
    setParseResult(result)
    setBankResult(null)
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
        skip: false,
        utlagg: null,
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
      const rows: PreviewRow[] = result.transactions.map((tx) => {
        const match = findMatchingMapping(tx.description, mappings, tx.bank)
        const isAmex = tx.bank === 'Amex'
        return {
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          bank: tx.bank,
          onCreditCard: isAmex,
          cardholder: tx.cardholder ?? null,
          suggestedCategoryId: match?.category_id ?? null,
          suggestedCategoryName: match?.category?.name ?? null,
          selectedCategoryId: match?.category_id ?? null,
          costAssignment: match?.cost_assignment ?? 'shared',
          mappingId: match?.id ?? null,
          warnings: !match ? ['Ingen automatisk kategorimatchning'] : [],
          skip: false,
          utlagg: null,
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
    const rowsToImport = previewRows.filter((r) => !r.skip && r.date && r.description && r.amount !== 0)
    const missingCategory = rowsToImport.filter((r) => !r.selectedCategoryId).length
    if (missingCategory > 0) {
      toast.error(`${missingCategory} rader saknar kategori. Välj kategori eller bocka i "Hoppa över" innan import.`)
      return
    }
    setStep('importing')
    let imported = 0
    for (const row of rowsToImport) {
      try {
        const utlagg = row.utlagg
        const budgetAmount = utlagg
          ? Math.round((utlagg.userShare + utlagg.partnerShare) * 100) / 100
          : row.amount
        await createExpense.mutateAsync({
          date: row.date,
          description: row.description,
          amount: budgetAmount,
          category_id: row.selectedCategoryId,
          cost_assignment: utlagg
            ? deriveCostAssignment(utlagg.userShare, utlagg.partnerShare)
            : row.costAssignment,
          is_ccm: row.onCreditCard,
          bank: row.bank,
          ...(utlagg && {
            is_group_purchase: true,
            group_purchase_total: row.amount,
            group_purchase_user_share: utlagg.userShare,
            group_purchase_partner_share: utlagg.partnerShare,
            group_purchase_swish_amount: Math.round((row.amount - budgetAmount) * 100) / 100,
            group_purchase_swish_recipient: utlagg.swishRecipient,
          }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        imported++
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

  // ---- AI-import helpers ----

  function getMergedRow(row: StagingRow): StagingRow {
    const edits = stagingEdits[row.id] || {}
    return { ...row, ...edits }
  }

  function updateStagingEdit(id: number, updates: Partial<StagingRow>) {
    setStagingEdits((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...updates } }))
  }

  function toggleBulkRow(id: number) {
    setBulkSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function applyBulkCategory() {
    if (!bulkCategoryId || bulkSelected.size === 0) return
    setStagingEdits((prev) => {
      const next = { ...prev }
      for (const id of bulkSelected) {
        next[id] = { ...(next[id] || {}), category_id: bulkCategoryId }
      }
      return next
    })
    const count = bulkSelected.size
    setBulkSelected(new Set())
    setBulkCategoryId(null)
    toast.success(`Kategori satt på ${count} rader`)
  }

  function exitBulkMode() {
    setBulkMode(false)
    setBulkSelected(new Set())
    setBulkCategoryId(null)
  }

  async function flushEdits() {
    const supabase = createClient()
    const entries = Object.entries(stagingEdits)
    for (const [idStr, updates] of entries) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('import_staging') as any).update(updates).eq('id', Number(idStr))
    }
    setStagingEdits({})
  }

  async function handleAiImport() {
    if (!activeBatchId) return

    const selectedRows = stagingRows.map((r) => getMergedRow(r)).filter((r) => r.selected)
    const missingCategory = selectedRows.filter((r) => !r.category_id).length
    if (missingCategory > 0) {
      toast.error(`${missingCategory} rader saknar kategori. Välj kategori eller bocka i "Hoppa över" innan import.`)
      return
    }

    setImportingStaging(true)
    await flushEdits()

    const rowsToImport = stagingRows
      .map((r) => getMergedRow(r))
      .filter((r) => r.selected && r.status === 'pending' && r.amount !== 0)

    const supabase = createClient()
    let imported = 0

    for (const row of rowsToImport) {
      try {
        const isUtlagg = row.is_group_purchase
        const uShare = row.group_purchase_user_share || 0
        const pShare = row.group_purchase_partner_share || 0
        const budgetAmount = isUtlagg ? Math.round((uShare + pShare) * 100) / 100 : row.amount
        await createExpense.mutateAsync({
          date: row.date,
          description: row.description,
          amount: budgetAmount,
          category_id: row.category_id,
          cost_assignment: isUtlagg ? deriveCostAssignment(uShare, pShare) : row.cost_assignment,
          is_ccm: row.is_ccm,
          bank: row.bank,
          ...(isUtlagg && {
            is_group_purchase: true,
            group_purchase_total: row.amount,
            group_purchase_user_share: uShare,
            group_purchase_partner_share: pShare,
            group_purchase_swish_amount: Math.round((row.amount - budgetAmount) * 100) / 100,
            group_purchase_swish_recipient: row.group_purchase_swish_recipient || 'user',
          }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        imported++
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('import_staging') as any)
          .update({ status: 'imported' })
          .eq('id', row.id)
      } catch (err) {
        console.error('AI import error:', err)
      }
    }

    // Delete the whole batch now that we're done
    await deleteBatch.mutateAsync(activeBatchId)
    setImportingStaging(false)
    setActiveBatchId(null)
    setStep('done')
    setImportedCount(imported)
    toast.success(`${imported} utgifter importerade från AI-import`)
  }

  // Computed stats (regular import)
  const totalRows = previewRows.length
  const matchedRows = previewRows.filter((r) => r.suggestedCategoryId).length
  const importableRows = previewRows.filter((r) => !r.skip).length
  const totalAmount = previewRows.filter((r) => !r.skip).reduce((s, r) => s + r.amount, 0)

  // Computed stats (AI import)
  const aiImportableRows = stagingRows.map(getMergedRow).filter((r) => r.selected).length
  const aiTotalAmount = stagingRows.map(getMergedRow).filter((r) => r.selected).reduce((s, r) => s + r.amount, 0)
  const aiUncategorised = stagingRows.map(getMergedRow).filter((r) => r.selected && !r.category_id).length

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
            {step === 'ai-batches' || step === 'ai-review'
              ? 'AI-förbehandlade importer redo att granska'
              : 'Ladda upp en CSV-fil från din bank eller en färdig Homebase-fil'}
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
          <ModeCard
            active={mode === 'ai'}
            onClick={() => setMode('ai')}
            title="AI-import"
            description="Claude har redan behandlat dina CSV-filer och lagt dem redo här. Granska och spara med ett tryck."
            icon="✨"
            badge={batches.length > 0 ? `${batches.length} batch${batches.length > 1 ? 'ar' : ''} redo` : undefined}
          />

          <button
            onClick={() => {
              if (mode === 'ai') setStep('ai-batches')
              else setStep('upload')
            }}
            className="w-full py-3 rounded-full bg-hb-nav text-hb-nav-foreground font-medium text-sm hover:opacity-90 transition-opacity"
          >
            Fortsätt
          </button>
        </motion.div>
      )}

      {/* Step: AI — batch list */}
      {step === 'ai-batches' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <button
            onClick={() => setStep('choose')}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" />
            Tillbaka
          </button>

          {batchesLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Hämtar batchar…</span>
            </div>
          )}

          {!batchesLoading && batches.length === 0 && (
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium text-sm mb-1">Inga AI-importer just nu</p>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
                Ladda upp dina CSV-filer i Claude-chatten så förbehandlar Claude dem och lägger dem redo här.
              </p>
            </div>
          )}

          {batches.map((batch) => (
            <BatchCard
              key={batch.batch_id}
              batch={batch}
              onOpen={() => {
                setActiveBatchId(batch.batch_id)
                setStagingEdits({})
                setStep('ai-review')
              }}
              onPin={() => togglePin.mutate({ batchId: batch.batch_id, pinned: !batch.pinned })}
              onDelete={() => {
                deleteBatch.mutate(batch.batch_id)
                toast.success('Batch raderad')
              }}
            />
          ))}
        </motion.div>
      )}

      {/* Step: AI — review rows */}
      {step === 'ai-review' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <button
            onClick={() => {
              setActiveBatchId(null)
              setStep('ai-batches')
            }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" />
            Alla batchar
          </button>

          {stagingLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Hämtar transaktioner…</span>
            </div>
          )}

          {!stagingLoading && stagingRows.length > 0 && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-2.5">
                <StatCard label="Att importera" value={aiImportableRows} accent="default" />
                <StatCard
                  label="Utan kategori"
                  value={aiUncategorised}
                  accent={aiUncategorised > 0 ? 'warn' : 'success'}
                />
                <StatCard label="Summa" value={aiTotalAmount} accent="default" isCurrency />
              </div>

              {aiUncategorised > 0 && (
                <div className="bg-hb-amber/10 border border-hb-amber/30 rounded-xl px-3 py-2 flex items-center gap-2 text-xs text-hb-amber">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  {aiUncategorised} rader saknar kategori — välj kategori eller bocka i &quot;Hoppa över&quot;
                </div>
              )}

              {/* Bulk toolbar */}
              <div className="flex items-center justify-between gap-2">
                {!bulkMode ? (
                  <button
                    onClick={() => setBulkMode(true)}
                    className="text-xs font-medium text-hb-cognac-deep bg-hb-cognac/10 hover:bg-hb-cognac/20 transition-colors rounded-full px-3 py-1.5"
                  >
                    Markera flera
                  </button>
                ) : (
                  <button
                    onClick={exitBulkMode}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-full px-3 py-1.5"
                  >
                    Avbryt markering
                  </button>
                )}
                {bulkMode && (
                  <button
                    onClick={() => setBulkSelected(new Set(stagingRows.map((r) => r.id)))}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Markera alla
                  </button>
                )}
              </div>

              {bulkMode && bulkSelected.size > 0 && (
                <div className="bg-hb-sage/15 border border-hb-sage/40 rounded-xl px-3 py-2.5 flex items-center gap-2 flex-wrap sticky top-0 z-10">
                  <span className="text-xs font-medium">{bulkSelected.size} markerade</span>
                  <CategoryCombobox
                    value={bulkCategoryId}
                    categories={categories}
                    onChange={setBulkCategoryId}
                    placeholder="Välj kategori…"
                  />
                  <button
                    onClick={applyBulkCategory}
                    disabled={!bulkCategoryId}
                    className="ml-auto text-xs font-medium bg-hb-cognac text-white rounded-full px-3 py-1.5 hover:bg-hb-cognac/90 disabled:opacity-40"
                  >
                    Tilldela kategori
                  </button>
                </div>
              )}

              {/* Row list */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="max-h-[60vh] overflow-y-auto">
                  {stagingRows.map((row) => {
                    const merged = getMergedRow(row)
                    return (
                      <AiPreviewRow
                        key={row.id}
                        row={merged}
                        categories={categories}
                        assignmentOptions={assignmentOptions}
                        onUpdate={(updates) => updateStagingEdit(row.id, updates)}
                        bulkMode={bulkMode}
                        bulkChecked={bulkSelected.has(row.id)}
                        onBulkToggle={() => toggleBulkRow(row.id)}
                        onOpenUtlagg={() => setSplitTarget({ kind: 'staging', id: row.id })}
                      />
                    )
                  })}
                </div>
              </div>

              <button
                onClick={handleAiImport}
                disabled={importingStaging || aiImportableRows === 0}
                className="w-full py-3 rounded-full bg-hb-nav text-hb-nav-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {importingStaging && <Loader2 className="w-4 h-4 animate-spin" />}
                {importingStaging ? 'Importerar…' : `Importera ${aiImportableRows} utgifter · ${formatCurrency(aiTotalAmount)}`}
              </button>
            </>
          )}
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
                  onOpenUtlagg={() => setSplitTarget({ kind: 'preview', index: idx })}
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

      {/* Utlägg split dialog (shared by bank preview + AI review) */}
      {(() => {
        const target = splitTarget
        if (!target) return null
        let total = 0
        let description = ''
        let initial: UtlaggSplit | null = null
        if (target.kind === 'preview') {
          const row = previewRows[target.index]
          if (!row) return null
          total = row.amount
          description = row.description
          initial = row.utlagg
        } else {
          const row = stagingRows.find((r) => r.id === target.id)
          if (!row) return null
          const merged = getMergedRow(row)
          total = merged.amount
          description = merged.description
          initial = merged.is_group_purchase
            ? {
                userShare: merged.group_purchase_user_share || 0,
                partnerShare: merged.group_purchase_partner_share || 0,
                swishRecipient: merged.group_purchase_swish_recipient || 'user',
              }
            : null
        }
        return (
          <UtlaggSplitDialog
            open
            onOpenChange={(o) => { if (!o) setSplitTarget(null) }}
            total={total}
            description={description}
            partnerName={partner?.first_name ?? null}
            initial={initial}
            onSave={(split) => {
              if (target.kind === 'preview') {
                updateRow(target.index, { utlagg: split })
              } else {
                updateStagingEdit(target.id, {
                  is_group_purchase: true,
                  group_purchase_user_share: split.userShare,
                  group_purchase_partner_share: split.partnerShare,
                  group_purchase_swish_recipient: split.swishRecipient,
                })
              }
            }}
            onRemove={() => {
              if (target.kind === 'preview') {
                updateRow(target.index, { utlagg: null })
              } else {
                updateStagingEdit(target.id, {
                  is_group_purchase: false,
                  group_purchase_user_share: null,
                  group_purchase_partner_share: null,
                  group_purchase_swish_recipient: null,
                })
              }
            }}
          />
        )
      })()}
    </div>
  )
}

// ---- Sub-components ----

function ModeCard({
  active, onClick, title, description, icon, badge,
}: {
  active: boolean
  onClick: () => void
  title: string
  description: string
  icon: string
  badge?: string
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
          <div className="flex items-center gap-2">
            <span className="font-serif text-[16px] font-medium tracking-tight">{title}</span>
            {badge && (
              <span className="text-[10px] font-semibold bg-hb-cognac/15 text-hb-cognac-deep px-2 py-0.5 rounded-full">
                {badge}
              </span>
            )}
          </div>
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

function BatchCard({
  batch, onOpen, onPin, onDelete,
}: {
  batch: StagingBatch
  onOpen: () => void
  onPin: () => void
  onDelete: () => void
}) {
  const expiresAt = new Date(batch.expires_at)
  const uploadedAt = new Date(batch.uploaded_at)
  const isExpiringSoon = !batch.pinned && expiresAt.getTime() - Date.now() < 6 * 60 * 60 * 1000

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button onClick={onOpen} className="w-full px-4 py-3.5 text-left hover:bg-secondary/50 transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-hb-cognac/10 grid place-items-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-hb-cognac" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium">
                {batch.bank || 'AI-import'} — {batch.row_count} transaktioner
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3 h-3" />
                Uppladdad {formatDistanceToNow(uploadedAt, { locale: sv, addSuffix: true })}
                {batch.pinned && (
                  <span className="text-hb-cognac-deep font-medium">· Fastnålad</span>
                )}
                {!batch.pinned && (
                  <span className={cn(isExpiringSoon ? 'text-destructive' : 'text-muted-foreground')}>
                    · Raderas {formatDistanceToNow(expiresAt, { locale: sv, addSuffix: true })}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="font-serif text-[15px] font-medium text-right">
              {formatCurrency(batch.total_amount)}
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </button>
      <div className="border-t border-border px-4 py-2 flex items-center gap-2">
        <button
          onClick={onPin}
          className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {batch.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
          {batch.pinned ? 'Lossa' : 'Nåla fast'}
        </button>
        <div className="flex-1" />
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 text-[11px] font-medium text-destructive/70 hover:text-destructive transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Radera
        </button>
      </div>
    </div>
  )
}

function AiPreviewRow({
  row, categories, assignmentOptions, onUpdate, bulkMode, bulkChecked, onBulkToggle, onOpenUtlagg,
}: {
  row: StagingRow
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  categories: any[]
  assignmentOptions: { value: 'personal' | 'shared' | 'partner'; label: string }[]
  onUpdate: (updates: Partial<StagingRow>) => void
  bulkMode: boolean
  bulkChecked: boolean
  onBulkToggle: () => void
  onOpenUtlagg: () => void
}) {
  const isDuplicate = row.dup_existing
  const isBlank = !row.category_id
  const utlaggBudget = row.is_group_purchase
    ? Math.round(((row.group_purchase_user_share || 0) + (row.group_purchase_partner_share || 0)) * 100) / 100
    : null

  return (
    <div
      className={cn(
        'px-4 py-3 border-b border-border last:border-b-0',
        !row.selected && 'opacity-50',
        isDuplicate && 'bg-destructive/5',
        isBlank && row.selected && 'bg-hb-amber/5',
        bulkMode && bulkChecked && 'bg-hb-sage/15'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1 flex items-center gap-2.5">
          {bulkMode && (
            <input
              type="checkbox"
              checked={bulkChecked}
              onChange={onBulkToggle}
              className="w-4 h-4 accent-hb-cognac flex-shrink-0"
            />
          )}
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{row.description}</div>
            <div className="text-[11px] text-muted-foreground">
              {row.date}
              {row.bank && ` · ${row.bank}`}
              {row.is_ccm && ' · Amex'}
              {row.cardholder && ` · ${row.cardholder}`}
              {row.match_source === 'blank' && (
                <span className="ml-1 text-hb-amber">· Ingen match</span>
              )}
              {isDuplicate && (
                <span className="ml-1 text-destructive">· Finns redan</span>
              )}
            </div>
          </div>
        </div>
        <span className={cn('font-serif text-[15px] font-medium flex-shrink-0', row.amount < 0 && 'text-success')}>
          {formatCurrency(row.amount)}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <CategoryCombobox
          value={row.category_id || null}
          categories={categories}
          onChange={(id) => onUpdate({ category_id: id })}
          error={isBlank && row.selected}
        />

        {utlaggBudget === null && (
          <select
            value={row.cost_assignment}
            onChange={(e) => onUpdate({ cost_assignment: e.target.value as 'personal' | 'shared' | 'partner' })}
            className="text-[11px] bg-secondary border border-border rounded-full px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-hb-cognac"
          >
            {assignmentOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}

        <button
          type="button"
          onClick={onOpenUtlagg}
          className={cn(
            'text-[11px] font-medium rounded-full px-2.5 py-1 flex items-center gap-1 border transition-colors',
            utlaggBudget !== null
              ? 'bg-hb-cognac/15 text-hb-cognac-deep border-hb-cognac/40'
              : 'bg-secondary border-border text-muted-foreground hover:border-hb-cognac/50'
          )}
        >
          <HandCoins className="w-3 h-3" />
          {utlaggBudget !== null ? `Utlägg · ${formatCurrency(utlaggBudget)} i budget` : 'Utlägg'}
        </button>

        <label className="text-[11px] text-muted-foreground flex items-center gap-1 cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={!row.selected}
            onChange={(e) => onUpdate({ selected: !e.target.checked })}
            className="w-3 h-3 accent-hb-cognac"
          />
          Hoppa över
        </label>
      </div>
    </div>
  )
}

function StatCard({ label, value, accent, isCurrency }: { label: string; value: number; accent: 'default' | 'success' | 'warn'; isCurrency?: boolean }) {
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
      <div className={cn('font-serif text-[22px] font-medium mt-1 truncate', color)}>
        {isCurrency ? formatCurrency(value) : value}
      </div>
    </div>
  )
}

function PreviewRowItem({
  row, categories, categoryById, onUpdate, onSaveRule, ruleSaved, showSaveRule, assignmentOptions, onOpenUtlagg,
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
  onOpenUtlagg: () => void
}) {
  const canSaveRule =
    showSaveRule && !row.suggestedCategoryId && !!row.selectedCategoryId && !ruleSaved
  const utlaggBudget = row.utlagg
    ? Math.round((row.utlagg.userShare + row.utlagg.partnerShare) * 100) / 100
    : null

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
            {row.cardholder && ` · ${row.cardholder}`}
          </div>
        </div>
        <span className="font-serif text-[15px] font-medium flex-shrink-0">
          {formatCurrency(row.amount)}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <CategoryCombobox
          value={row.selectedCategoryId || null}
          categories={categories}
          onChange={(id) => onUpdate({ selectedCategoryId: id })}
        />

        {utlaggBudget === null && (
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
        )}

        <button
          type="button"
          onClick={onOpenUtlagg}
          className={cn(
            'text-[11px] font-medium rounded-full px-2.5 py-1 flex items-center gap-1 border transition-colors',
            utlaggBudget !== null
              ? 'bg-hb-cognac/15 text-hb-cognac-deep border-hb-cognac/40'
              : 'bg-secondary border-border text-muted-foreground hover:border-hb-cognac/50'
          )}
        >
          <HandCoins className="w-3 h-3" />
          {utlaggBudget !== null ? `Utlägg · ${formatCurrency(utlaggBudget)} i budget` : 'Utlägg'}
        </button>

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
