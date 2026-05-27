'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStatementAnalyses, useAnalyzeStatement } from '@/hooks/use-statement-analyzer'
import { StatementUploadForm } from '@/components/statement/statement-upload-form'
import { StatementLoading } from '@/components/statement/statement-loading'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { motion } from 'framer-motion'
import { FileText, Upload, History, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { formatCurrency } from '@/lib/utils/formatters'
import { toast } from 'sonner'

export default function StatementAnalyzerPage() {
  const router = useRouter()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const { data: analyses } = useStatementAnalyses()
  const analyzeStatement = useAnalyzeStatement()

  async function handleAnalyze(file: File, bankId: string, userId: string) {
    setIsAnalyzing(true)
    try {
      const result = await analyzeStatement.mutateAsync({ file, bankId, userId })
      // Auto-navigate to review page
      if (result?.analysisId) {
        router.push(`/statement-analyzer/${result.analysisId}/review`)
      } else {
        toast.error('Analysen slutfördes men inget id returnerades')
        setIsAnalyzing(false)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kunde inte analysera kontoutdraget')
      setIsAnalyzing(false)
    }
  }

  function handleSelectAnalysis(analysisId: string) {
    router.push(`/statement-analyzer/${analysisId}/review`)
  }

  // Show loading animation while analyzing
  if (isAnalyzing) {
    return <StatementLoading />
  }

  return (
    <div className="p-4 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-hb-cognac">
          Importera kontoutdrag
        </h1>
        <p className="text-sm text-muted-foreground">
          Ladda upp en PDF eller CSV-fil från din bank
        </p>
      </motion.div>

      <Tabs defaultValue="upload" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="w-4 h-4" />
            Ladda upp
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="w-4 h-4" />
            Historik
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <StatementUploadForm onAnalyze={handleAnalyze} />
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Tidigare analyser</CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y">
              {analyses?.map(analysis => (
                <button
                  key={analysis.id}
                  onClick={() => handleSelectAnalysis(analysis.id)}
                  className="w-full p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left"
                >
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">{analysis.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {analysis.bank_name} • {analysis.transaction_count} transaktioner
                      {analysis.invoice_total && (
                        <> • {formatCurrency(analysis.invoice_total)}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(analysis.created_at), 'd MMM yyyy', { locale: sv })}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
              {analyses?.length === 0 && (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  Inga analyser ännu
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
