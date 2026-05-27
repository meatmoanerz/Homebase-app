'use client'

import { motion } from 'framer-motion'
import { Receipt, Sparkles } from 'lucide-react'

export default function ReceiptsPage() {
  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Desktop title (hidden on mobile, mobile shows in header) */}
      <div className="hidden md:block">
        <h1 className="font-serif text-[32px] font-medium tracking-tight">Kvitton</h1>
        <p className="text-sm text-muted-foreground mt-1">Inköp och prisanalys</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-2xl p-8 md:p-12 text-center shadow-sm"
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-hb-cognac/10 grid place-items-center mb-5">
          <Receipt className="w-7 h-7 text-hb-cognac" />
        </div>
        <h2 className="font-serif text-xl font-medium mb-2">Kvittohantering kommer snart</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Här kommer du snart kunna ladda upp kvitton från ICA, Hemköp och andra butiker.
          Appen läser av varje rad och spårar priser över tid för att hitta var dina varor är billigast.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 text-xs text-hb-cognac-deep">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="font-medium">Under utveckling</span>
        </div>
      </motion.div>
    </div>
  )
}
