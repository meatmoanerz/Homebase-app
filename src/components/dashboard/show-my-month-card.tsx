'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronRight, BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'

export function ShowMyMonthCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Link href="/report">
        <Card className="border-0 shadow-sm bg-gradient-to-r from-hb-cognac to-hb-cognac/80 text-white cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Visa min månad</p>
                  <p className="text-xs text-white/70">Detaljerad månadsrapport med insikter</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-white/70" />
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
}
