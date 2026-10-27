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

      <BottomSheet open={helpOpen} onOpenChange={setHelpOpen} title="Kvitton från Kivra och ICA" subtitle="Två sätt att få in dem">
        <div className="space-y-5 text-[13px] leading-relaxed">
          <p>
            ICA och Kivra har inget öppet API för att hämta kvitton automatiskt, så kvittot delas härifrån — ett
            tryck per kvitto.
          </p>
          <section>
            <h4 className="font-medium text-[14px] mb-1">1. Dela till Claude-appen (ingen API-nyckel)</h4>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>Öppna kvittot i Kivra (eller ta en skärmdump i ICA-appen) → <b>Dela</b> → <b>Claude</b>.</li>
              <li>Välj projektet där Homebase-dokumentationen finns och skriv <i>spara kvittot</i>.</li>
              <li>Claude läser av det och sparar det här enligt <code className="text-[12px]">docs/06-kvitton.md</code> — butik, varor, koppling till köpet.</li>
            </ol>
          </section>
          <section>
            <h4 className="font-medium text-[14px] mb-1">2. Direkt till Homebase (kräver API-nyckel i Vercel)</h4>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>Ny genväg <b>Kvitto till Homebase</b>, <b>Visa i delningsmenyn</b>, tar emot <b>Bilder</b> och <b>PDF</b>.</li>
              <li><b>Konvertera bild</b> → JPEG och <b>Ändra storlek på bild</b> → bredd 2000 (inte för PDF).</li>
              <li>
                <b>Hämta innehåll från URL</b>: <code className="text-[12px]">https://homebase-app-omega.vercel.app/api/receipts/ingest</code>,
                POST, rubrik <code className="text-[12px]">Authorization: Bearer &lt;Wallet-token&gt;</code>, brödtext <b>Fil</b>.
              </li>
              <li><b>Hämta ordboksvärde</b> <code className="text-[12px]">message</code> → <b>Visa meddelande</b>.</li>
            </ol>
          </section>
          <p className="text-muted-foreground flex gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            Samma kvitto två gånger sparas bara en gång, oavsett väg.
          </p>
        </div>
      </BottomSheet>
    </div>
  )
}
