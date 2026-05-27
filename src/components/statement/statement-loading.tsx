'use client'

import { motion } from 'framer-motion'
import { FileSearch, Sparkles } from 'lucide-react'

const loadingMessages = [
  'Läser in PDF...',
  'Analyserar transaktioner...',
  'Identifierar köp...',
  'Extraherar belopp...',
  'Nästan klar...',
]

export function StatementLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      {/* Animated icon */}
      <motion.div
        className="relative"
        animate={{
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <div className="w-24 h-24 rounded-full bg-hb-sage/20 flex items-center justify-center">
          <FileSearch className="w-12 h-12 text-hb-cognac" />
        </div>

        {/* Orbiting sparkle */}
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2"
          animate={{
            rotate: 360,
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{ transformOrigin: '50% 60px' }}
        >
          <Sparkles className="w-5 h-5 text-hb-terracotta" />
        </motion.div>
      </motion.div>

      {/* Progress bar */}
      <div className="w-64 h-1.5 bg-muted rounded-full mt-8 overflow-hidden">
        <motion.div
          className="h-full bg-hb-cognac rounded-full"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{
            duration: 150,
            ease: 'easeOut',
          }}
        />
      </div>

      {/* Rotating messages */}
      <div className="h-8 mt-6 overflow-hidden">
        <motion.div
          animate={{
            y: [0, -32, -64, -96, -128],
          }}
          transition={{
            duration: 40,
            repeat: Infinity,
            times: [0, 0.2, 0.4, 0.6, 0.8],
          }}
        >
          {loadingMessages.map((message, i) => (
            <p key={i} className="h-8 flex items-center justify-center text-muted-foreground">
              {message}
            </p>
          ))}
        </motion.div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground/60">
        Detta kan ta några minuter beroende på filens storlek
      </p>
    </div>
  )
}
