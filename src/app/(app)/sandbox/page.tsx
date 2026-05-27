'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ExpenseForm } from '@/components/expenses/expense-form'
import { ExpenseFormCompact } from '@/components/expenses/expense-form-compact'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { motion } from 'framer-motion'

export default function SandboxPage() {
  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <h1 className="text-2xl font-bold text-hb-cognac">Sandbox</h1>
        <p className="text-sm text-muted-foreground">
          Testa nya layouts och komponenter
        </p>
      </motion.div>

      {/* Expense Form Comparison */}
      <Tabs defaultValue="compact">
        <TabsList className="w-full">
          <TabsTrigger value="compact" className="flex-1">Kompakt (ny)</TabsTrigger>
          <TabsTrigger value="original" className="flex-1">Original</TabsTrigger>
        </TabsList>

        <TabsContent value="compact" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Kompakt layout</CardTitle>
              <CardDescription className="text-xs">
                Mer komprimerad design utan scroll. Kategorier som chips, horisontell layout.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExpenseFormCompact />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="original" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Original layout</CardTitle>
              <CardDescription className="text-xs">
                Nuvarande design med vertikala fält och stort beloppinput.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExpenseForm />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
