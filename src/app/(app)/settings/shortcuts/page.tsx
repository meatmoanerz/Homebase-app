'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { ArrowLeft, Copy, CreditCard, KeyRound, Loader2, Receipt, Trash2, Info } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUser } from '@/hooks/use-user'
import { useIsClient } from '@/hooks/use-is-client'
import { useCreateWalletToken, useRevokeWalletToken, useWalletTokens } from '@/hooks/use-wallet-tokens'
import { cn } from '@/lib/utils/cn'

// Cards the Wallet endpoint accepts (src/app/api/wallet/[card]/route.ts).
const WALLET_CARDS = [
  { slug: 'amex', label: 'Amex' },
  { slug: 'norwegian', label: 'Norwegian' },
] as const

// Optional ready-made iCloud shortcut links. When set, users install the
// shortcut with one tap and only paste their key.
const WALLET_SHORTCUT_URL = process.env.NEXT_PUBLIC_WALLET_SHORTCUT_URL
const RECEIPT_SHORTCUT_URL = process.env.NEXT_PUBLIC_RECEIPT_SHORTCUT_URL

function copy(text: string, what: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${what} kopierad`),
    () => toast.error('Kunde inte kopiera')
  )
}

function CopyField({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2">
      <code className="flex-1 min-w-0 truncate text-[12px]">{value}</code>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={`Kopiera ${label}`} onClick={() => copy(value, label)}>
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="list-decimal pl-5 space-y-2 text-[13px] text-muted-foreground marker:text-foreground">{children}</ol>
}

export default function ShortcutsPage() {
  const router = useRouter()
  const isClient = useIsClient()
  const { data: user } = useUser()
  const { data: tokens = [], isLoading } = useWalletTokens()
  const createToken = useCreateWalletToken()
  const revokeToken = useRevokeWalletToken()
  const [label, setLabel] = useState('')
  const [newToken, setNewToken] = useState<string | null>(null)
  const [card, setCard] = useState<(typeof WALLET_CARDS)[number]['slug']>('amex')

  const origin = isClient ? window.location.origin : ''
  const walletUrl = `${origin}/api/wallet/${card}`
  const receiptUrl = `${origin}/api/receipts/ingest`
  const keyText = newToken ?? '<din nyckel>'

  async function handleCreate() {
    const name = label.trim() || user?.first_name || 'Min iPhone'
    const result = await createToken.mutateAsync(name).catch(() => null)
    if (result) {
      setNewToken(result.token)
      setLabel('')
    }
  }

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="hidden md:flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-hb-cognac">iPhone-genvägar</h1>
          <p className="text-sm text-muted-foreground">Kortköp och kvitton direkt från telefonen</p>
        </div>
      </motion.div>

      <p className="text-sm text-muted-foreground">
        Med appen Genvägar på iPhone kan köp du gör med Apple Pay och kvitton du delar hamna i Homebase automatiskt.
        Genvägen använder en personlig nyckel, så allt hamnar på ditt konto och ingen annans.
      </p>

      {/* Step 1: key */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-hb-cognac" />
            1. Skapa en nyckel
          </CardTitle>
          <CardDescription className="text-xs">
            Skapa en nyckel per telefon. Namnet visas på köpen som kommer in, så att ni ser vem som handlade.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {newToken ? (
            <div className="space-y-2 rounded-xl border border-hb-cognac/40 bg-hb-sage/15 p-3">
              <p className="text-[13px] font-medium">Din nyckel</p>
              <CopyField value={newToken} label="Nyckeln" />
              <p className="text-[12px] text-muted-foreground">
                Kopiera den nu, den visas bara en gång. Behandla den som ett lösenord. Tappar du bort den skapar du en ny och
                tar bort den gamla.
              </p>
              <Button variant="outline" size="sm" onClick={() => setNewToken(null)}>
                Jag har kopierat den
              </Button>
            </div>
          ) : (
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="token-label" className="text-xs">Namn</Label>
                <Input
                  id="token-label"
                  placeholder={user?.first_name || 'Min iPhone'}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={40}
                />
              </div>
              <Button onClick={handleCreate} disabled={createToken.isPending}>
                {createToken.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Skapa nyckel'}
              </Button>
            </div>
          )}

          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : tokens.length > 0 ? (
            <div className="divide-y divide-border rounded-xl border border-border">
              {tokens.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.cardholder}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Skapad {format(new Date(t.created_at), 'd MMM yyyy', { locale: sv })}
                      {' · '}
                      {t.last_used_at
                        ? `senast använd ${format(new Date(t.last_used_at), 'd MMM HH:mm', { locale: sv })}`
                        : 'inte använd än'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Ta bort nyckeln ${t.cardholder}`}
                    disabled={revokeToken.isPending}
                    onClick={() => {
                      if (window.confirm(`Ta bort nyckeln "${t.cardholder}"? Genvägar som använder den slutar fungera.`)) {
                        revokeToken.mutate(t.id)
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Step 2: Wallet purchases */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-hb-cognac" />
            2. Kortköp med Apple Pay
          </CardTitle>
          <CardDescription className="text-xs">
            Varje köp med kortet skickas till Homebase och hamnar under Importera, där du granskar det innan det sparas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg bg-secondary/50 p-2.5 text-[12px] text-muted-foreground">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Fungerar just nu för kreditkorten Amex och Norwegian, och kräver att{' '}
              {user?.ccm_enabled ? 'Kreditkort är påslaget (det är det).' : (
                <>
                  Kreditkort är påslaget under <Link href="/settings" className="underline">Mer › Funktioner</Link>.
                </>
              )}
            </span>
          </div>

          <div className="flex gap-1 p-1 bg-muted/50 rounded-xl" role="tablist" aria-label="Välj kort">
            {WALLET_CARDS.map((c) => (
              <button
                key={c.slug}
                role="tab"
                aria-selected={card === c.slug}
                onClick={() => setCard(c.slug)}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                  card === c.slug ? 'bg-white dark:bg-card shadow-sm text-hb-cognac' : 'text-muted-foreground'
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          {WALLET_SHORTCUT_URL && (
            <Button asChild className="w-full">
              <a href={WALLET_SHORTCUT_URL} target="_blank" rel="noopener noreferrer">
                Installera färdig genväg
              </a>
            </Button>
          )}

          <Steps>
            <li>Öppna appen <strong>Genvägar</strong> och gå till fliken <strong>Automatisering</strong>.</li>
            <li>
              Tryck på <strong>+</strong>, välj <strong>Transaktion</strong> och välj ditt {WALLET_CARDS.find((c) => c.slug === card)?.label}-kort.
              Välj <strong>Kör omedelbart</strong>.
            </li>
            <li>
              Lägg till åtgärden <strong>Hämta innehåll från URL</strong> och klistra in adressen:
              <div className="mt-1.5"><CopyField value={walletUrl} label="Adressen" /></div>
            </li>
            <li>
              Tryck på pilen i åtgärden. Sätt <strong>Metod</strong> till <strong>POST</strong>. Under{' '}
              <strong>Rubriker</strong> lägger du till <code>Authorization</code> med värdet:
              <div className="mt-1.5"><CopyField value={`Bearer ${keyText}`} label="Rubriken" /></div>
            </li>
            <li>
              Under <strong>Begärandetext</strong> väljer du <strong>JSON</strong> och lägger till två fält:{' '}
              <code>merchant</code> = variabeln <strong>Handlare</strong> och <code>amount</code> = variabeln{' '}
              <strong>Belopp</strong>.
            </li>
            <li>
              Valfritt: lägg till <strong>Visa avisering</strong> med resultatet, så ser du &quot;Sparat&quot; efter varje köp.
            </li>
          </Steps>
        </CardContent>
      </Card>

      {/* Step 3: receipts */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Receipt className="w-4 h-4 text-hb-cognac" />
            3. Kvitton från Kivra eller ICA
          </CardTitle>
          <CardDescription className="text-xs">
            Dela ett kvitto till genvägen så läses varorna in och kopplas till köpet. Du hittar dem under Kvitton, som du slår på under Mer › Funktioner.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {RECEIPT_SHORTCUT_URL && (
            <Button asChild className="w-full">
              <a href={RECEIPT_SHORTCUT_URL} target="_blank" rel="noopener noreferrer">
                Installera färdig genväg
              </a>
            </Button>
          )}
          <Steps>
            <li>
              Skapa en ny genväg i <strong>Genvägar</strong> och slå på <strong>Visa i delningsblad</strong> i genvägens
              inställningar. Välj att den tar emot <strong>PDF</strong> och <strong>bilder</strong>.
            </li>
            <li>
              Lägg till <strong>Hämta innehåll från URL</strong> med adressen:
              <div className="mt-1.5"><CopyField value={receiptUrl} label="Adressen" /></div>
            </li>
            <li>
              Sätt <strong>Metod</strong> till <strong>POST</strong>, lägg till rubriken <code>Authorization</code> med samma
              värde som ovan, och välj <strong>Fil</strong> som begärandetext med <strong>Genvägsindata</strong>.
            </li>
            <li>Lägg till <strong>Visa avisering</strong> med resultatet.</li>
          </Steps>
        </CardContent>
      </Card>
    </div>
  )
}
