'use client'

import { useCategories } from '@/hooks/use-categories'
import { useHouseholdCategories, useToggleHouseholdCategory } from '@/hooks/use-household-categories'
import { useUser } from '@/hooks/use-user'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { LoadingPage } from '@/components/shared/loading-spinner'
import { cn } from '@/lib/utils/cn'
import { motion } from 'framer-motion'
import { ArrowLeft, Home } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function HouseholdCategoriesPage() {
  const router = useRouter()
  const { data: user, isLoading: userLoading } = useUser()
  const { data: categories = [], isLoading: catLoading } = useCategories()
  const { data: householdCategories = [], isLoading: hcLoading } = useHouseholdCategories()
  const toggleMutation = useToggleHouseholdCategory()

  const isLoading = userLoading || catLoading || hcLoading

  if (isLoading) {
    return <LoadingPage />
  }

  const householdCategoryIds = new Set(householdCategories.map(hc => hc.category_id))

  // Group categories by cost type
  const fixedCategories = categories.filter(c => c.cost_type === 'Fixed')
  const variableCategories = categories.filter(c => c.cost_type === 'Variable')
  const savingsCategories = categories.filter(c => c.cost_type === 'Savings')

  const toggleCategory = (categoryId: string) => {
    toggleMutation.mutate({
      categoryId,
      isHousehold: householdCategoryIds.has(categoryId),
    })
  }

  const groups = [
    { title: 'Fasta kostnader', items: fixedCategories },
    { title: 'Rörliga kostnader', items: variableCategories },
    { title: 'Sparande', items: savingsCategories },
  ]

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <div className="flex items-center gap-4 mb-1">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-hb-cognac">Hushållskostnader</h1>
            <p className="text-sm text-muted-foreground">
              Välj vilka kategorier som räknas som hushållskostnader.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Info card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Card className="border-0 shadow-sm bg-hb-sage/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-hb-cognac/10 flex items-center justify-center shrink-0">
                <Home className="w-5 h-5 text-hb-cognac" />
              </div>
              <p className="text-sm text-muted-foreground">
                Hushållskostnader summeras i din månadsrapport. Om du har en partner visas även fördelningen per person.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Category groups */}
      {groups.map((group, groupIndex) => (
        <motion.div
          key={group.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + groupIndex * 0.05 }}
        >
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{group.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {group.items.map(category => (
                <div
                  key={category.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer',
                    householdCategoryIds.has(category.id)
                      ? 'bg-hb-sage/30'
                      : 'bg-muted/50 hover:bg-muted'
                  )}
                  onClick={() => toggleCategory(category.id)}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={householdCategoryIds.has(category.id)}
                      onCheckedChange={() => toggleCategory(category.id)}
                    />
                    <span className="font-medium text-sm">{category.name}</span>
                  </div>
                </div>
              ))}
              {group.items.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">Inga kategorier</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}

      <p className="text-xs text-muted-foreground text-center">
        {householdCategoryIds.size} kategori{householdCategoryIds.size !== 1 ? 'er' : ''} vald{householdCategoryIds.size !== 1 ? 'a' : ''}
      </p>
    </div>
  )
}
