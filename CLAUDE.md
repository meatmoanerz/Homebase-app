# CLAUDE.md - Homebase

**See main documentation**: `../CLAUDE.md`

## Quick Reference

### Essential Context
- **Salary-based budget periods**: Budgets run from salary day to salary day (not calendar months)
- **Budget period utilities**: `src/lib/utils/budget-period.ts`
- **Partner sharing**: Users can connect and share budgets/expenses (Tim & Amanda)
- **Cost assignment**: `personal`, `shared`, `partner` (affects budget calculations)
- **CCM**: Credit Card Manager with invoice period tracking (`is_ccm` flag on expenses)
- **Grocery module**: Receipts + line items + products for price tracking over time
- **Smart import**: Two-mode CSV import (raw bank file with auto-categorization, or pre-formatted Homebase CSV)
- **Category mappings**: Living lookup table (`category_mappings`) — substring match, longest-match-wins, learns from manual categorizations

### Key Tech Stack
- Next.js 16 App Router + React 19
- Supabase (PostgreSQL + Auth + Realtime + RLS)
- TanStack Query v5 (server state)
- Tailwind CSS v4 + shadcn/ui
- TypeScript strict mode
- pnpm package manager

### Common Commands
```bash
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm lint             # Run ESLint
```

### Critical Files
- `src/lib/utils/budget-period.ts` - Budget period calculations
- `src/hooks/use-*.ts` - TanStack Query hooks for all data
- `src/types/database.ts` - Auto-generated Supabase schema types
- `src/types/index.ts` - App-level type exports
- `src/lib/supabase/client.ts` - Browser Supabase client
- `src/lib/supabase/server.ts` - Server Supabase client
- `src/components/realtime-provider.tsx` - Realtime subscriptions
- `src/stores/` - Zustand stores (filter-store, ui-store)
- `src/hooks/use-perspective.ts` - All/Me/Partner perspective store
- `src/hooks/use-receipts.ts` - Grocery receipts, items, price history hooks
- `src/hooks/use-category-mappings.ts` - Auto-categorization rules + matching
- `src/lib/import/bank-parsers.ts` - SEB/Swedbank/Amex CSV parsers
- `src/lib/import/csv-parser.ts` - Homebase standard CSV parser

### Development Rules
1. Always use budget period utilities for date filtering (never hardcode)
2. Use TanStack Query for all server state
3. Invalidate related queries after mutations
4. Follow cost assignment logic: personal (100%), shared (50/50), partner (0%)
5. Test partner features with two separate accounts
6. Use proper TypeScript types (no `any`)
7. Use `next-intl` for all user-facing strings
8. Add translations to both `sv.json` and `en.json`
9. All tables have RLS - add policies for new tables
10. Use named exports (no default exports for components)

### Database Pattern
```typescript
// Browser client (Client Components)
import { createClient } from '@/lib/supabase/client'

// Server client (Server Components / API routes)
import { createClient } from '@/lib/supabase/server'

// Query with RLS (automatic user/partner filtering)
const { data } = await supabase
  .from('expenses')
  .select('*, category:categories(*)')
  .order('date', { ascending: false })
```

### Query Key Patterns
```typescript
['user']                        // Current user
['partner']                     // Partner profile
['expenses', options]           // Expenses with filters
['expenses', 'period', period]  // Period-specific
['expenses', 'ccm', breakDate] // CCM expenses
['budgets']                     // All budgets
['budget', id]                  // Specific budget
['categories']                  // Categories
['dashboard']                   // Dashboard data
['savings-goals']               // Savings goals
['loans']                       // Loans
['monthly-incomes', period]     // Period incomes
['recurring-expenses']          // Recurring expenses
['ccm-invoices']                // CCM invoices
```

### Mutation Invalidation Pattern
```typescript
return useMutation({
  mutationFn: async (data) => { /* ... */ },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['expenses'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    toast.success('Success message')
  },
  onError: () => {
    toast.error('Error message')
  },
})
```

### Component Conventions
- Feature-based: `components/{feature}/{feature}-{type}.tsx`
- Types: `*-form.tsx`, `*-list.tsx`, `*-card.tsx`, `*-dialog.tsx`, `*-skeleton.tsx`
- `'use client'` only when needed (hooks, events, browser APIs)
- Use `cn()` from `@/lib/utils/cn` for conditional classes
- Colors: `stacka-olive` (primary), `stacka-sage`, `stacka-mint`, `stacka-peach`, `stacka-coral` (CCM), `stacka-blue` (shared)

For full documentation, architectural details, database schema, and comprehensive guides, see `../CLAUDE.md`.
