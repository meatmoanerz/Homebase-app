'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser, usePartner, usePartnerConnection } from '@/hooks/use-user'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { LoadingPage } from '@/components/shared/loading-spinner'
import { getInitials } from '@/lib/utils/formatters'
import { motion } from 'framer-motion'
import { ArrowLeft, Users, Copy, UserPlus, Check, LinkIcon, AlertCircle, Unlink, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { useQueryClient } from '@tanstack/react-query'

export default function PartnerSettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  
  const { data: user, isLoading: userLoading } = useUser()
  const { data: partner, isLoading: partnerLoading, refetch: refetchPartner } = usePartner()
  const { data: connection, refetch: refetchConnection } = usePartnerConnection()
  
  const [inviteCode, setInviteCode] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  // Check for existing pending invite on mount
  useEffect(() => {
    async function checkExistingInvite() {
      if (!user) return
      
      const { data } = await supabase
        .from('partner_connections')
        .select('invite_code, expires_at')
        .eq('initiated_by', user.id)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()

      const typedData = data as { invite_code: string; expires_at: string } | null
      if (typedData?.invite_code) {
        setGeneratedCode(typedData.invite_code)
      }
    }
    checkExistingInvite()
  }, [user, supabase])

  if (userLoading || partnerLoading) {
    return <LoadingPage />
  }

  async function generateInviteCode() {
    if (!user) return
    setError('')
    
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    
    // Delete any existing pending invites first
    await supabase
      .from('partner_connections')
      .delete()
      .eq('initiated_by', user.id)
      .eq('status', 'pending')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('partner_connections').insert({
      user1_id: user.id,
      user2_id: user.id,
      initiated_by: user.id,
      invite_code: code,
      status: 'pending',
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })

    if (error) {
      console.error('Error creating invite:', error)
      toast.error('Kunde inte skapa inbjudan')
    } else {
      setGeneratedCode(code)
      toast.success('Inbjudningskod skapad!')
    }
  }

  async function joinWithCode() {
    if (!user || !inviteCode) return
    setJoining(true)
    setError('')

    const codeToCheck = inviteCode.toUpperCase().trim()

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: rpcError } = await (supabase as any)
        .rpc('join_partner_connection', {
          p_invite_code: codeToCheck,
          p_user_id: user.id
        })

      console.log('Join result:', data, 'Error:', rpcError)

      if (rpcError) {
        console.error('RPC error:', rpcError)
        setError('Kunde inte gå med. Försök igen.')
        setJoining(false)
        return
      }

      if (!data.success) {
        switch (data.error) {
          case 'invalid_or_expired_code':
            setError('Ogiltig eller utgången kod')
            break
          case 'cannot_join_own_invite':
            setError('Du kan inte gå med i din egen inbjudan')
            break
          case 'already_connected':
            setError('Du är redan kopplad med en partner')
            break
          default:
            setError('Kunde inte gå med. Försök igen.')
        }
        setJoining(false)
        return
      }

      toast.success('Du är nu kopplad med din partner! 🎉')
      
      // Refresh all data
      await refetchPartner()
      await refetchConnection()
      queryClient.invalidateQueries({ queryKey: ['partner'] })
      queryClient.invalidateQueries({ queryKey: ['partner-connection'] })
    } catch (err) {
      console.error('Join error:', err)
      setError('Ett fel uppstod. Försök igen.')
    }
    
    setJoining(false)
  }

  async function disconnectPartner() {
    if (!connection) return
    setDisconnecting(true)

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('partner_connections')
        .update({ status: 'revoked' })
        .eq('id', connection.id)

      if (error) {
        console.error('Disconnect error:', error)
        toast.error('Kunde inte koppla från')
      } else {
        toast.success('Du har kopplat från din partner')
        setShowDisconnectDialog(false)
        
        // Refresh data
        await refetchPartner()
        await refetchConnection()
        queryClient.invalidateQueries({ queryKey: ['partner'] })
        queryClient.invalidateQueries({ queryKey: ['partner-connection'] })
      }
    } catch (err) {
      console.error('Disconnect error:', err)
      toast.error('Ett fel uppstod')
    }

    setDisconnecting(false)
  }

  const connectedSince = connection?.created_at 
    ? format(new Date(connection.created_at), "d MMMM yyyy", { locale: sv })
    : null

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-hb-cognac">Partner</h1>
          <p className="text-sm text-muted-foreground">Dela budget med din partner</p>
        </div>
      </motion.div>

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </motion.div>
      )}

      {partner && connection ? (
        /* Connected Partner */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Check className="w-5 h-5 text-success" />
                Kopplad med partner
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-success/10">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={partner.avatar_url || undefined} />
                  <AvatarFallback className="bg-hb-sage text-hb-cognac text-xl">
                    {getInitials(partner.first_name, partner.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold text-lg">{partner.first_name} {partner.last_name}</p>
                  <p className="text-sm text-muted-foreground">{partner.email}</p>
                </div>
              </div>
              
              {connectedSince && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>Kopplade sedan {connectedSince}</span>
                </div>
              )}

              <div className="pt-2">
                <h4 className="text-sm font-medium mb-2">Ni delar nu:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    Varandras utgifter
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    Gemensamma budgetar
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    Fördelning av kostnader
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    Realtidssynkronisering
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Disconnect button */}
          <Card className="border-0 shadow-sm border-destructive/20">
            <CardContent className="p-4">
              <Button
                variant="outline"
                className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setShowDisconnectDialog(true)}
              >
                <Unlink className="w-4 h-4 mr-2" />
                Koppla från partner
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        /* Not Connected */
        <>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <LinkIcon className="w-5 h-5" />
                  Bjud in partner
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!generatedCode ? (
                  <Button onClick={generateInviteCode} className="w-full">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Generera inbjudningskod
                  </Button>
                ) : (
                  <div className="p-4 bg-hb-sage/20 rounded-xl text-center">
                    <p className="text-sm text-muted-foreground mb-2">Din inbjudningskod:</p>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-2xl font-bold tracking-widest text-hb-cognac">
                        {generatedCode}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedCode)
                          toast.success('Kod kopierad!')
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Giltig i 1 timme
                    </p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Skicka koden till din partner så kan hen gå med i ditt konto.
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Har du fått en kod?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="inviteCode">Ange kod</Label>
                  <Input
                    id="inviteCode"
                    placeholder="ABC123"
                    value={inviteCode}
                    onChange={(e) => {
                      setInviteCode(e.target.value.toUpperCase())
                      setError('')
                    }}
                    className="text-center text-lg tracking-widest"
                    maxLength={6}
                  />
                </div>
                <Button 
                  onClick={joinWithCode} 
                  disabled={!inviteCode || inviteCode.length < 6 || joining}
                  className="w-full"
                >
                  {joining ? 'Går med...' : 'Gå med'}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-0 shadow-sm bg-hb-tim/10">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Users className="w-5 h-5 text-hb-tim shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-hb-cognac mb-1">Vad händer när ni är kopplade?</p>
                    <ul className="text-muted-foreground space-y-1">
                      <li>• Ni ser varandras utgifter</li>
                      <li>• Dela gemensamma budgetar</li>
                      <li>• Fördela kostnader mellan er</li>
                      <li>• Synka i realtid</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}

      {/* Disconnect Dialog */}
      <Dialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Koppla från partner?
            </DialogTitle>
            <DialogDescription className="pt-2">
              Är du säker på att du vill koppla från {partner?.first_name}? 
              <br /><br />
              <strong>Detta innebär att:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Ni slutar dela utgifter</li>
                <li>Gemensamma budgetar separeras</li>
                <li>Båda måste bjuda in varandra igen för att koppla ihop på nytt</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setShowDisconnectDialog(false)}
              disabled={disconnecting}
            >
              Avbryt
            </Button>
            <Button 
              variant="destructive" 
              onClick={disconnectPartner}
              disabled={disconnecting}
            >
              {disconnecting ? 'Kopplar från...' : 'Ja, koppla från'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
