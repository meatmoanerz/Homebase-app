'use client'

import Link from 'next/link'
import { ChevronRight, BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'

export function ShowMyMonthCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Link
        href="/report"
        className="block bg-card border border-border rounded-2xl px-4 py-3.5 shadow-sm hover:bg-secondary/40 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-hb-cognac/12 grid place-items-center">
              <BarChart3 className="w-[18px] h-[18px] text-hb-cognac-deep" />
            </div>
            <div>
              <div className="font-medium text-sm tracking-tight">Visa min månad</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Detaljerad månadsrapport med insikter
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/70" />
        </div>
      </Link>
    </motion.div>
  )
}
