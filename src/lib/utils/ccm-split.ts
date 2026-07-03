import type { ExpenseWithCategory } from '@/types'

export interface PaymentSplit {
  userAmount: number
  partnerAmount: number
  unregisteredDifference: number
  registeredTotal: number
  actualInvoice: number
  hasWarning: boolean
}

export function calculatePaymentSplit(
  expenses: ExpenseWithCategory[],
  actualInvoiceAmount: number,
  userId: string,
  partnerId: string | null
): PaymentSplit {
  let userPersonal = 0
  let userShared = 0
  let userSwishResponsibility = 0
  let partnerPersonal = 0
  let partnerShared = 0
  let partnerSwishResponsibility = 0

  expenses.forEach((expense) => {
    const amount = expense.amount

    // Handle group purchases (utlägg) separately
    if (expense.is_group_purchase) {
      const swishAmount = expense.group_purchase_swish_amount || 0
      const swishRecipient = expense.group_purchase_swish_recipient
      const hasStoredShares =
        expense.group_purchase_user_share != null || expense.group_purchase_partner_share != null

      if (hasStoredShares) {
        // Use the exact stored shares. user_share/partner_share are from the
        // perspective of the expense owner (expense.user_id).
        const ownerShare = expense.group_purchase_user_share || 0
        const otherShare = expense.group_purchase_partner_share || 0
        if (expense.user_id === userId) {
          userPersonal += ownerShare
          partnerPersonal += otherShare
        } else {
          partnerPersonal += ownerShare
          userPersonal += otherShare
        }
      } else if (expense.cost_assignment === 'personal') {
        if (expense.user_id === userId) {
          userPersonal += amount
        } else {
          partnerPersonal += amount
        }
      } else if (expense.cost_assignment === 'shared') {
        userShared += amount / 2
        partnerShared += amount / 2
      } else if (expense.cost_assignment === 'partner') {
        partnerPersonal += amount
      }

      // Add Swish responsibility based on recipient
      if (swishRecipient === 'user') {
        userSwishResponsibility += swishAmount
      } else if (swishRecipient === 'partner') {
        partnerSwishResponsibility += swishAmount
      } else if (swishRecipient === 'shared') {
        userSwishResponsibility += swishAmount / 2
        partnerSwishResponsibility += swishAmount / 2
      }

      return // Skip normal processing
    }

    // Normal expense processing
    if (expense.cost_assignment === 'personal') {
      if (expense.user_id === userId) {
        userPersonal += amount
      } else {
        partnerPersonal += amount
      }
    } else if (expense.cost_assignment === 'shared') {
      userShared += amount / 2
      partnerShared += amount / 2
    } else if (expense.cost_assignment === 'partner') {
      partnerPersonal += amount
    }
  })

  // For group purchases, use group_purchase_total for invoice matching
  const registeredTotal = expenses.reduce((sum, exp) => {
    if (exp.is_group_purchase) {
      return sum + (exp.group_purchase_total || exp.amount)
    }
    return sum + exp.amount
  }, 0)

  const unregisteredDifference = actualInvoiceAmount - registeredTotal

  // Split unregistered difference 50/50
  const userUnregistered = unregisteredDifference > 0 ? unregisteredDifference / 2 : 0
  const partnerUnregistered = unregisteredDifference > 0 ? unregisteredDifference / 2 : 0

  return {
    userAmount: userPersonal + userShared + userSwishResponsibility + userUnregistered,
    partnerAmount: partnerPersonal + partnerShared + partnerSwishResponsibility + partnerUnregistered,
    unregisteredDifference: Math.max(0, unregisteredDifference),
    registeredTotal,
    actualInvoice: actualInvoiceAmount,
    hasWarning: registeredTotal > actualInvoiceAmount && actualInvoiceAmount > 0,
  }
}
