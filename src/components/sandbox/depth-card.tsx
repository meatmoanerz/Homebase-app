'use client'

import { CreditCard3D } from '@/components/ccm/credit-card-3d'
import { formatCurrency } from '@/lib/utils/formatters'
import { mockSpend } from './sandbox-data'

/** Sandbox demo of the 3D card used on the Kreditkort page, with mock numbers. */
export function DepthCard() {
  return (
    <div>
      <CreditCard3D
        label="Kreditkort"
        caption="Obetalt · förfaller 24 nov"
        amount={mockSpend.nextInvoice.value}
        footerLeft="1 kort"
        footerRight={`${formatCurrency(mockSpend.nextInvoice.registered)} denna period`}
      />
      <p className="text-center text-[12px] text-muted-foreground">
        Dra fingret eller musen över kortet. Ingen lutning med reducerad rörelse.
      </p>
    </div>
  )
}
