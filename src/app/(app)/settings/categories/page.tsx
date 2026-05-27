'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCategoriesByType, useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/hooks/use-categories'
import { useUser } from '@/hooks/use-user'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { LoadingPage } from '@/components/shared/loading-spinner'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Plus, Trash2, Pencil, Coins } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils/formatters'
import type { Category, CostType, SubcategoryType } from '@/types'

const subcategories: { value: SubcategoryType; label: string }[] = [
  { value: 'Home', label: 'Hem' },
  { value: 'Housing', label: 'Boende' },
  { value: 'Transport', label: 'Transport' },
  { value: 'Entertainment', label: 'Nöje' },
  { value: 'Loans', label: 'Lån' },
  { value: 'Savings', label: 'Sparande' },
  { value: 'Other', label: 'Övrigt' },
]

const costTypes: { value: CostType; label: string }[] = [
  { value: 'Fixed', label: 'Fast' },
  { value: 'Variable', label: 'Rörlig' },
  { value: 'Savings', label: 'Sparande' },
]

export default function CategoriesSettingsPage() {
  const router = useRouter()
  const { data: user } = useUser()
  const { fixed, variable, savings, isLoading } = useCategoriesByType()
  
  const [categoryDialog, setCategoryDialog] = useState<{ 
    open: boolean
    category?: Category
    type: CostType 
  }>({ open: false, type: 'Variable' })
  
  const [name, setName] = useState('')
  const [subcategory, setSubcategory] = useState<SubcategoryType>('Other')
  const [costType, setCostType] = useState<CostType>('Variable')
  const [defaultValue, setDefaultValue] = useState<number>(0)
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null)
  
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategoryMutation = useDeleteCategory()

  if (isLoading) {
    return <LoadingPage />
  }

  function openDialog(type: CostType, category?: Category) {
    setCategoryDialog({ open: true, category, type })
    setName(category?.name || '')
    setSubcategory(category?.subcategory || 'Other')
    setCostType(category?.cost_type || type)
    setDefaultValue(category?.default_value || 0)
  }

  async function handleSaveCategory() {
    if (!name || !user) return

    try {
      if (categoryDialog.category) {
        await updateCategory.mutateAsync({
          id: categoryDialog.category.id,
          name,
          subcategory,
          cost_type: costType,
          default_value: defaultValue,
        })
        toast.success('Kategori uppdaterad!')
      } else {
        await createCategory.mutateAsync({
          user_id: user.id,
          name,
          cost_type: costType,
          subcategory,
          default_value: defaultValue,
        })
        toast.success('Kategori skapad!')
      }
      setCategoryDialog({ open: false, type: 'Variable' })
    } catch {
      toast.error('Något gick fel')
    }
  }

  async function handleDeleteCategory() {
    if (!deleteCategory) return
    try {
      await deleteCategoryMutation.mutateAsync(deleteCategory.id)
      toast.success('Kategori borttagen')
      setDeleteCategory(null)
    } catch {
      toast.error('Kunde inte ta bort kategorin')
    }
  }

  const renderCategoryList = (categories: Category[], type: CostType) => (
    <div className="space-y-2">
      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Inga kategorier ännu
        </p>
      ) : (
        <AnimatePresence>
          {categories.map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ delay: index * 0.03 }}
              className="flex items-center justify-between p-3 rounded-xl bg-muted/30"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{category.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{subcategories.find(s => s.value === category.subcategory)?.label}</span>
                  {category.default_value > 0 && (
                    <>
                      <span className="text-muted-foreground/50">•</span>
                      <span className="flex items-center gap-0.5 text-hb-cognac">
                        <Coins className="w-3 h-3" />
                        {formatCurrency(category.default_value)}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openDialog(type, category)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                {!category.is_default && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => setDeleteCategory(category)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
      <Button
        variant="outline"
        className="w-full mt-2"
        onClick={() => openDialog(type)}
      >
        <Plus className="w-4 h-4 mr-2" />
        Lägg till kategori
      </Button>
    </div>
  )

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-hb-cognac">Kategorier</h1>
          <p className="text-sm text-muted-foreground">Hantera dina utgiftskategorier</p>
        </div>
      </motion.div>

      {/* Category Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Tabs defaultValue="Variable">
          <TabsList className="w-full">
            <TabsTrigger value="Fixed" className="flex-1">Fast</TabsTrigger>
            <TabsTrigger value="Variable" className="flex-1">Rörligt</TabsTrigger>
            <TabsTrigger value="Savings" className="flex-1">Sparande</TabsTrigger>
          </TabsList>

          <TabsContent value="Fixed">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Fasta kostnader</CardTitle>
              </CardHeader>
              <CardContent>
                {renderCategoryList(fixed, 'Fixed')}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="Variable">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Rörliga kostnader</CardTitle>
              </CardHeader>
              <CardContent>
                {renderCategoryList(variable, 'Variable')}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="Savings">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Sparande</CardTitle>
              </CardHeader>
              <CardContent>
                {renderCategoryList(savings, 'Savings')}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Category Dialog */}
      <Dialog 
        open={categoryDialog.open} 
        onOpenChange={(open) => setCategoryDialog({ ...categoryDialog, open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {categoryDialog.category ? 'Redigera kategori' : 'Ny kategori'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="categoryName">Namn</Label>
              <Input
                id="categoryName"
                placeholder="T.ex. Lunch, Gym"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Typ</Label>
              <Select value={costType} onValueChange={(v) => setCostType(v as CostType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {costTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Underkategori</Label>
              <Select value={subcategory} onValueChange={(v) => setSubcategory(v as SubcategoryType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {subcategories.map((sub) => (
                    <SelectItem key={sub.value} value={sub.value}>
                      {sub.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultValue">Standardvärde för budget</Label>
              <p className="text-xs text-muted-foreground">
                Detta belopp fylls i automatiskt när du skapar en ny budget
              </p>
              <div className="relative">
                <Input
                  id="defaultValue"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={defaultValue || ''}
                  onChange={(e) => {
                    const value = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0
                    setDefaultValue(value)
                  }}
                  className="pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  kr
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setCategoryDialog({ ...categoryDialog, open: false })}
            >
              Avbryt
            </Button>
            <Button onClick={handleSaveCategory}>
              {categoryDialog.category ? 'Spara' : 'Skapa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteCategory} onOpenChange={() => setDeleteCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ta bort kategori?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Är du säker på att du vill ta bort "{deleteCategory?.name}"? 
            Utgifter kopplade till denna kategori påverkas inte.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCategory(null)}>
              Avbryt
            </Button>
            <Button variant="destructive" onClick={handleDeleteCategory}>
              Ta bort
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

