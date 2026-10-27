'use client'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Camera, Loader2, Share, Info } from 'lucide-react'
import { toast } from 'sonner'
import { BottomSheet } from '@/components/shared/bottom-sheet'
import { cn } from '@/lib/utils/cn'

const MAX_SIDE = 2000

/** Downscale a photo to a JPEG well under the upload limit (also turns HEIC into JPEG). */
async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Kunde inte läsa bilden'))), 'image/jpeg', 0.85)
  )
}

interface ReceiptUploadButtonProps {
  onSaved: (receiptId: string) => void
  className?: string
}

/**
 * "Läs in kvitto": photo or PDF → Claude reads it → saved and matched to the
 * card purchase. Also explains the share shortcut for Kivra/ICA receipts.
 */
export function ReceiptUploadButton({ onSaved, className }: ReceiptUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  const upload = async (file: File) => {
    setBusy(true)
    const toastId = toast.loading('Läser kvittot… (brukar ta 10–30 s)')
    try {
      const body = new FormData()
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      body.append('file', isPdf ? file : await shrinkImage(file), isPdf ? file.name : 'kvitto.jpg')
      const res = await fetch('/api/receipts/upload', { method: 'POST', body })
      const json = await res.json().catch(() => ({ ok: false, error: 'Oväntat svar från servern' }))
      if (!res.ok || !json.ok) throw new Error(json.error || 'Kvittot kunde inte läsas')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['receipts'] }),
        queryClient.invalidateQueries({ queryKey: ['receipt-items'] }),
      ])
      toast.success(
        json.duplicate
          ? 'Kvittot fanns redan'
          : `${json.store ?? 'Kvitto'} sparat · ${json.itemCount} rader${json.expenseId ? ' · kopplat till köpet' : ''}${json.totalsMismatch ? ' · kontrollera summan' : ''}`,
        { id: toastId }
      )
      onSaved(json.receiptId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kvittot kunde inte läsas', { id: toastId })
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className={cn('flex gap-2', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) upload(file)
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-hb-nav text-hb-nav-foreground py-2.5 text-[13px] font-medium disabled:opacity-70"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
        {busy ? 'Läser kvittot…' : 'Läs in kvitto'}
      </button>
      <button
        type="button"
        onClick={() => setHelpOpen(true)}
        className="flex items-center gap-1.5 rounded-2xl border border-border bg-card px-3 text-[12px] text-muted-foreground"
      >
        <Share className="w-4 h-4" />
        Från Kivra/ICA
      </button>

      <BottomSheet open={helpOpen} onOpenChange={setHelpOpen} title="Kvitton från Kivra och ICA" subtitle="Dela kvittot direkt till Homebase">
        <div className="space-y-4 text-[13px] leading-relaxed">
          <p>
            ICA och Kivra har inget öppet API för att hämta kvitton automatiskt. Det smidigaste är att dela kvittot
            därifrån med en iPhone-genväg — ett tryck per kvitto, så läser Claude av det och sparar det här.
          </p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Öppna <b>Genvägar</b> → ny genväg som heter <b>Kvitto till Homebase</b>.</li>
            <li>Slå på <b>Visa i delningsmenyn</b> och välj att den tar emot <b>Bilder</b> och <b>PDF</b>.</li>
            <li>Lägg till <b>Konvertera bild</b> → JPEG och <b>Ändra storlek på bild</b> → bredd 2000 (hoppa över för PDF).</li>
            <li>
              Lägg till <b>Hämta innehåll från URL</b>: <code className="text-[12px]">https://homebase-app-omega.vercel.app/api/receipts/ingest</code>,
              metod <b>POST</b>, rubrik <code className="text-[12px]">Authorization: Bearer &lt;samma token som Wallet-genvägen&gt;</code>,
              brödtext <b>Fil</b> = genvägens indata.
            </li>
            <li>Lägg till <b>Hämta ordboksvärde</b> för <code className="text-[12px]">message</code> och <b>Visa meddelande</b>.</li>
          </ol>
          <p className="text-muted-foreground flex gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            I Kivra: öppna kvittot → Dela → Kvitto till Homebase. Saknas en dela-knapp (t.ex. i ICA-appen): ta en
            skärmdump av kvittot och dela den. Samma kvitto två gånger sparas bara en gång.
          </p>
        </div>
      </BottomSheet>
    </div>
  )
}
