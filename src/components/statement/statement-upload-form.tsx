'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useUser } from '@/hooks/use-user'
import { getAllBanks } from '@/lib/statement/bank-configs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'

interface Props {
  onAnalyze: (file: File, bankId: string, userId: string) => void
}

export function StatementUploadForm({ onAnalyze }: Props) {
  const { data: user } = useUser()
  const [selectedBank, setSelectedBank] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)
  const banks = getAllBanks()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0])
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
  })

  function handleSubmit() {
    if (!file || !selectedBank || !user?.id) {
      toast.error('Välj bank och fil')
      return
    }

    onAnalyze(file, selectedBank, user.id)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ladda upp kontoutdrag</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Välj bank</label>
          <Select value={selectedBank} onValueChange={setSelectedBank}>
            <SelectTrigger>
              <SelectValue placeholder="Välj din bank..." />
            </SelectTrigger>
            <SelectContent>
              {banks.map(bank => (
                <SelectItem key={bank.id} value={bank.id}>
                  {bank.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
            isDragActive ? "border-hb-cognac bg-hb-sage/20" : "border-border hover:border-hb-sage",
            file && "border-success bg-success/10"
          )}
        >
          <input {...getInputProps()} />
          {file ? (
            <div className="flex items-center justify-center gap-2 text-success">
              <FileText className="w-6 h-6" />
              <span className="font-medium">{file.name}</span>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {isDragActive
                  ? 'Släpp filen här...'
                  : 'Dra och släpp en fil, eller klicka för att välja'}
              </p>
              <p className="text-xs text-muted-foreground">
                Stöder CSV och PDF
              </p>
            </div>
          )}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!file || !selectedBank}
          className="w-full bg-hb-cognac hover:bg-hb-cognac/90"
        >
          Analysera kontoutdrag
        </Button>
      </CardContent>
    </Card>
  )
}
