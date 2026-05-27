'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useUser, usePartner } from '@/hooks/use-user'
import { useCategoriesByType } from '@/hooks/use-categories'
import { useCreateGroupPurchase, useUpdateGroupPurchase } from '@/hooks/use-group-purchase'
import { formatCurrency } from '@/lib/utils/formatters'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  Users,
  User,
  UserCheck,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { motion, AnimatePresence } from 'framer-motion'
import type { Category, ExpenseWithCategory } from '@/types'

type WizardStep = 'total' | 'shares' | 'swish-recipient' | 'review'

interface GroupPurchaseWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editExpense?: ExpenseWithCategory | null
}

export function GroupPurchaseWizard({ open, onOpenChange, editExpense }: GroupPurchaseWizardProps) {
  const { data: user } = useUser()
  const { data: partner } = usePartner()
  const { variable, fixed, savings } = useCategoriesByType()
  const createGroupPurchase = useCreateGroupPurchase()
  const updateGroupPurchase = useUpdateGroupPurchase()
  const isEditMode = !!editExpense

  const [currentStep, setCurrentStep] = useState<WizardStep>('total')
  const [totalAmount, setTotalAmount] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [userShare, setUserShare] = useState('')
  const [partnerShare, setPartnerShare] = useState('')
  const [swishRecipient, setSwishRecipient] = useState<'user' | 'partner' | 'shared'>('user')
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [categorySearch, setCategorySearch] = useState('')

  const amountInputRef = useRef<HTMLInputElement>(null)
  const categoryDropdownRef = useRef<HTMLDivElement>(null)

  const hasPartner = !!partner
  const allCategories = useMemo(() => [...variable, ...fixed, ...savings], [variable, fixed, savings])
  const selectedCategory = allCategories.find(c => c.id === categoryId)

  const filteredCategories = useMemo(() => {
    if (!categorySearch) return { variable, fixed, savings }
    const search = categorySearch.toLowerCase()
    return {
      variable: variable.filter(c => c.name.toLowerCase().includes(search)),
      fixed: fixed.filter(c => c.name.toLowerCase().includes(search)),
      savings: savings.filter(c => c.name.toLowerCase().includes(search)),
    }
  }, [categorySearch, variable, fixed, savings])

  const totalNum = parseInt(totalAmount.replace(/\D/g, ''), 10) || 0
  const userShareNum = parseInt(userShare.replace(/\D/g, ''), 10) || 0
  const partnerShareNum = parseInt(partnerShare.replace(/\D/g, ''), 10) || 0
  const swishAmount = totalNum - userShareNum - partnerShareNum
  const sharesSum = userShareNum + partnerShareNum + Math.max(0, swishAmount)

  // Auto-focus amount input when step 1 opens
  useEffect(() => {
    if (open && currentStep === 'total' && amountInputRef.current) {
      setTimeout(() => amountInputRef.current?.focus(), 100)
    }
  }, [open, currentStep])

  // Pre-fill fields when editing an existing group purchase
  useEffect(() => {
    if (editExpense && open) {
      setTotalAmount((editExpense.group_purchase_total || editExpense.amount).toString())
      setDescription(editExpense.description)
      setCategoryId(editExpense.category_id || '')
      setDate(editExpense.date)
      setUserShare((editExpense.group_purchase_user_share || 0).toString())
      setPartnerShare((editExpense.group_purchase_partner_share || 0).toString())
      setSwishRecipient((editExpense.group_purchase_swish_recipient as 'user' | 'partner' | 'shared') || 'user')
      setCurrentStep('total')
    }
  }, [editExpense, open])

  // Close category dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setCategoryOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const goNext = () => {
    if (currentStep === 'total') {
      setCurrentStep('shares')
      // Default: set empty shares so user can fill in manually
      if (!hasPartner) {
        setUserShare(totalNum.toString())
        setPartnerShare('0')
      }
    } else if (currentStep === 'shares') {
      if (hasPartner && swishAmount > 0) {
        setCurrentStep('swish-recipient')
      } else {
        setCurrentStep('review')
      }
    } else if (currentStep === 'swish-recipient') {
      setCurrentStep('review')
    }
  }

  const goBack = () => {
    if (currentStep === 'review') {
      if (hasPartner && swishAmount > 0) {
        setCurrentStep('swish-recipient')
      } else {
        setCurrentStep('shares')
      }
    } else if (currentStep === 'swish-recipient') {
      setCurrentStep('shares')
    } else if (currentStep === 'shares') {
      setCurrentStep('total')
    }
  }

  const handleSubmit = async () => {
    try {
      const payload = {
        totalAmount: totalNum,
        description,
        category_id: categoryId,
        date,
        userShare: userShareNum,
        partnerShare: partnerShareNum,
        swishRecipient,
      }

      if (isEditMode && editExpense) {
        await updateGroupPurchase.mutateAsync({ id: editExpense.id, ...payload })
      } else {
        await createGroupPurchase.mutateAsync(payload)
      }
      onOpenChange(false)
      resetWizard()
    } catch {
      // Error handled in mutation hook
    }
  }

  const resetWizard = () => {
    setCurrentStep('total')
    setTotalAmount('')
    setDescription('')
    setCategoryId('')
    setDate(format(new Date(), 'yyyy-MM-dd'))
    setUserShare('')
    setPartnerShare('')
    setSwishRecipient('user')
    setCategorySearch('')
    setCategoryOpen(false)
  }

  const isStepValid = () => {
    if (currentStep === 'total') {
      return totalNum > 0 && description.length > 0 && categoryId.length > 0
    }
    if (currentStep === 'shares') {
      return sharesSum === totalNum && (userShareNum + partnerShareNum > 0)
    }
    if (currentStep === 'swish-recipient') {
      return true
    }
    return true
  }

  const getStepNumber = () => {
    if (currentStep === 'total') return 1
    if (currentStep === 'shares') return 2
    if (currentStep === 'swish-recipient') return 3
    if (currentStep === 'review') return hasPartner && swishAmount > 0 ? 4 : 3
    return 1
  }

  const getTotalSteps = () => {
    if (!hasPartner) return 3 // total, shares, review
    if (swishAmount > 0) return 4 // total, shares, swish, review
    return 3 // total, shares, review
  }

  const handleCategorySelect = (category: Category) => {
    setCategoryId(category.id)
    setCategorySearch('')
    setCategoryOpen(false)
  }

  const formatDisplayDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return format(d, 'd MMMM yyyy', { locale: sv })
    } catch {
      return dateStr
    }
  }


  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o) resetWizard()
      onOpenChange(o)
    }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-hb-cognac" />
            {isEditMode ? 'Redigera gruppköp' : 'Lägg till gruppköp'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Steg {getStepNumber()} av {getTotalSteps()}
          </p>
        </DialogHeader>

        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {/* Step 1: Total Expense */}
            {currentStep === 'total' && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <p className="text-sm text-muted-foreground">
                  Ange totalt belopp du betalade med kreditkort
                </p>

                {/* Amount */}
                <div className="space-y-2">
                  <Label>Totalt belopp</Label>
                  <div className="relative">
                    <input
                      ref={amountInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={totalAmount}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '')
                        setTotalAmount(val)
                      }}
                      placeholder="0"
                      className="w-full h-14 px-4 text-2xl font-bold rounded-lg bg-muted/50 border border-border focus:border-hb-cognac focus:ring-1 focus:ring-hb-cognac outline-none transition-colors"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">kr</span>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label>Beskrivning</Label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="T.ex. Middag restaurang"
                    className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border focus:border-hb-cognac focus:ring-1 focus:ring-hb-cognac outline-none transition-colors text-sm"
                  />
                </div>

                {/* Category */}
                <div className="space-y-2" ref={categoryDropdownRef}>
                  <Label>Kategori</Label>
                  <div className="relative">
                    <div
                      onClick={() => setCategoryOpen(!categoryOpen)}
                      className="w-full h-10 px-3 flex items-center justify-between rounded-lg bg-muted/50 border border-border cursor-pointer hover:border-hb-cognac/50 transition-colors"
                    >
                      <span className={cn("text-sm", !selectedCategory && "text-muted-foreground")}>
                        {selectedCategory?.name || 'Välj kategori'}
                      </span>
                      <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", categoryOpen && "rotate-180")} />
                    </div>

                    {categoryOpen && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        <div className="p-2 border-b">
                          <input
                            type="text"
                            value={categorySearch}
                            onChange={(e) => setCategorySearch(e.target.value)}
                            placeholder="Sök kategori..."
                            className="w-full h-8 px-2 text-sm rounded bg-muted/50 border-0 outline-none"
                            autoFocus
                          />
                        </div>
                        {[
                          { label: 'Rörliga', items: filteredCategories.variable },
                          { label: 'Fasta', items: filteredCategories.fixed },
                          { label: 'Sparande', items: filteredCategories.savings },
                        ].map(({ label, items }) => items.length > 0 && (
                          <div key={label}>
                            <p className="text-[10px] font-medium text-muted-foreground px-3 py-1 uppercase">{label}</p>
                            {items.map((cat) => (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => handleCategorySelect(cat)}
                                className={cn(
                                  "w-full px-3 py-2 text-sm text-left hover:bg-muted transition-colors flex items-center justify-between",
                                  cat.id === categoryId && "bg-hb-cognac/10 text-hb-cognac"
                                )}
                              >
                                {cat.name}
                                {cat.id === categoryId && <Check className="w-3.5 h-3.5" />}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Date */}
                <div className="space-y-2">
                  <Label>Datum</Label>
                  <div className="relative">
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border focus:border-hb-cognac focus:ring-1 focus:ring-hb-cognac outline-none transition-colors text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">{formatDisplayDate(date)}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Dela upp kostnad */}
            {currentStep === 'shares' && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <p className="text-base font-semibold">Dela upp kostnad</p>

                {/* Total amount reference */}
                <div className="p-4 bg-hb-sand/20 dark:bg-hb-cognac/10 rounded-lg">
                  <p className="text-sm text-muted-foreground">Totalt belopp</p>
                  <p className="text-2xl font-bold text-hb-cognac">
                    {formatCurrency(totalNum)}
                  </p>
                </div>

                <div className="border-t border-border" />

                {/* Jag betalar */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5" />
                    Jag betalar
                  </Label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={userShare}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '')
                        setUserShare(val)
                      }}
                      placeholder="0"
                      className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border focus:border-hb-cognac focus:ring-1 focus:ring-hb-cognac outline-none transition-colors text-sm font-medium"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kr</span>
                  </div>
                </div>

                {/* Partner betalar */}
                {hasPartner && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <UserCheck className="w-3.5 h-3.5" />
                      Partner betalar
                    </Label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={partnerShare}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '')
                          setPartnerShare(val)
                        }}
                        placeholder="0"
                        className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border focus:border-hb-cognac focus:ring-1 focus:ring-hb-cognac outline-none transition-colors text-sm font-medium"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kr</span>
                    </div>
                  </div>
                )}

                {/* Övriga/ingen betalar (readonly, auto-calculated) */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-3.5 h-3.5" />
                    Övriga/ingen betalar
                  </Label>
                  <div className="relative">
                    <input
                      type="text"
                      value={swishAmount.toString()}
                      readOnly
                      className={cn(
                        "w-full h-10 px-3 rounded-lg border outline-none transition-colors text-sm font-medium cursor-not-allowed",
                        swishAmount < 0
                          ? "bg-destructive/10 border-destructive/30 text-destructive"
                          : "bg-muted/30 border-border text-muted-foreground"
                      )}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kr</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Beräknas automatiskt</p>
                </div>

                <div className="border-t border-border" />

                {/* Summa validation row */}
                <div className={cn(
                  "p-3 rounded-lg border flex items-center justify-between",
                  sharesSum === totalNum
                    ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                    : "bg-destructive/5 border-destructive/20"
                )}>
                  <div>
                    <p className="text-sm font-medium">
                      Summa: {formatCurrency(sharesSum)}
                      {sharesSum === totalNum ? ' \u2713' : ' \u2717'}
                    </p>
                    {sharesSum !== totalNum && (
                      <p className="text-xs text-destructive mt-0.5">
                        {sharesSum > totalNum
                          ? 'Summan överstiger totalbeloppet'
                          : 'Beloppet matchar inte totalsumman'}
                      </p>
                    )}
                  </div>
                  {sharesSum === totalNum ? (
                    <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <span className="text-lg text-destructive font-bold">&times;</span>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 3: Swish Recipient */}
            {currentStep === 'swish-recipient' && hasPartner && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <p className="text-sm text-muted-foreground">
                  Vem fick Swish-betalningarna? ({formatCurrency(swishAmount)})
                </p>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setSwishRecipient('user')}
                    className={cn(
                      "w-full p-4 rounded-lg border-2 transition-all text-left",
                      swishRecipient === 'user'
                        ? "border-hb-cognac bg-hb-sand/20 dark:bg-hb-cognac/10"
                        : "border-border hover:border-hb-cognac/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-hb-cognac/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-hb-cognac" />
                      </div>
                      <div>
                        <p className="font-medium">{user?.first_name || 'Jag'} fick Swish</p>
                        <p className="text-xs text-muted-foreground">
                          Jag ansvarar för {formatCurrency(swishAmount)} på fakturan
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSwishRecipient('partner')}
                    className={cn(
                      "w-full p-4 rounded-lg border-2 transition-all text-left",
                      swishRecipient === 'partner'
                        ? "border-hb-cognac bg-hb-sand/20 dark:bg-hb-cognac/10"
                        : "border-border hover:border-hb-cognac/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-hb-cognac/10 flex items-center justify-center">
                        <UserCheck className="w-5 h-5 text-hb-cognac" />
                      </div>
                      <div>
                        <p className="font-medium">{partner?.first_name || 'Partner'} fick Swish</p>
                        <p className="text-xs text-muted-foreground">
                          {partner?.first_name || 'Partner'} ansvarar för {formatCurrency(swishAmount)} på fakturan
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSwishRecipient('shared')}
                    className={cn(
                      "w-full p-4 rounded-lg border-2 transition-all text-left",
                      swishRecipient === 'shared'
                        ? "border-hb-cognac bg-hb-sand/20 dark:bg-hb-cognac/10"
                        : "border-border hover:border-hb-cognac/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-hb-cognac/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-hb-cognac" />
                      </div>
                      <div>
                        <p className="font-medium">Delat (50/50)</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(swishAmount / 2)} var på fakturan
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Review */}
            {currentStep === 'review' && (
              <motion.div
                key="review"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <p className="text-sm text-muted-foreground">
                  Kontrollera uppgifterna
                </p>

                <div className="space-y-3">
                  {/* Total */}
                  <div className="p-4 rounded-lg bg-hb-terracotta/10 dark:bg-hb-terracotta/5">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Totalt på kreditkort</p>
                        <p className="text-xl font-bold text-hb-terracotta">{formatCurrency(totalNum)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{description}</p>
                        <p className="text-xs text-muted-foreground">{selectedCategory?.name} &middot; {formatDisplayDate(date)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Shares breakdown */}
                  <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Fördelning</p>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-hb-cognac" />
                        <span className="text-sm">{user?.first_name || 'Du'}</span>
                      </div>
                      <span className="font-semibold">{formatCurrency(userShareNum)}</span>
                    </div>

                    {hasPartner && partnerShareNum > 0 && (
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-hb-cognac" />
                          <span className="text-sm">{partner?.first_name || 'Partner'}</span>
                        </div>
                        <span className="font-semibold">{formatCurrency(partnerShareNum)}</span>
                      </div>
                    )}

                    {swishAmount > 0 && (
                      <>
                        <div className="border-t pt-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Swish tillbaka</span>
                            <span className="font-semibold text-hb-cognac">{formatCurrency(swishAmount)}</span>
                          </div>
                          {hasPartner && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Mottagen av: {swishRecipient === 'user'
                                ? (user?.first_name || 'Du')
                                : swishRecipient === 'partner'
                                  ? (partner?.first_name || 'Partner')
                                  : 'Delat 50/50'}
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Budget impact */}
                  <div className="p-4 rounded-lg bg-hb-cognac/10 dark:bg-hb-cognac/5">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Budgetpåverkan</p>
                    <p className="text-lg font-bold text-hb-cognac mt-1">
                      {formatCurrency(userShareNum + partnerShareNum)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Bara er andel ({formatCurrency(userShareNum + partnerShareNum)}) påverkar budgeten
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation buttons */}
          <div className="flex gap-2">
            {currentStep !== 'total' && (
              <Button
                type="button"
                variant="outline"
                onClick={goBack}
                disabled={createGroupPurchase.isPending || updateGroupPurchase.isPending}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Tillbaka
              </Button>
            )}

            <Button
              type="button"
              className={cn(
                "flex-1",
                currentStep === 'review' && "bg-hb-cognac hover:bg-hb-cognac/90"
              )}
              onClick={currentStep === 'review' ? handleSubmit : goNext}
              disabled={!isStepValid() || createGroupPurchase.isPending || updateGroupPurchase.isPending}
            >
              {(createGroupPurchase.isPending || updateGroupPurchase.isPending) ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sparar...
                </>
              ) : currentStep === 'review' ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {isEditMode ? 'Spara ändringar' : 'Skapa gruppköp'}
                </>
              ) : (
                <>
                  Nästa
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
