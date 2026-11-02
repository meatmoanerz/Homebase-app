// Optional modules a user can switch on. The core (overview, expenses, budget,
// import) is always on. See supabase/migrations/20261101130000_profiles_modules_and_intros.sql

export const ALL_OPTIONAL_MODULES = ['savings', 'loans', 'ccm', 'receipts', 'shared', 'meals'] as const
export type OptionalModule = (typeof ALL_OPTIONAL_MODULES)[number]

export function isOptionalModule(value: unknown): value is OptionalModule {
  return typeof value === 'string' && (ALL_OPTIONAL_MODULES as readonly string[]).includes(value)
}

export interface ModuleInfo {
  id: OptionalModule
  label: string
  description: string
  href: string
}

export const MODULE_INFO: Record<OptionalModule, ModuleInfo> = {
  savings: {
    id: 'savings',
    label: 'Sparmål',
    description: 'Spara mot mål som buffert, resa eller bostad',
    href: '/savings',
  },
  loans: {
    id: 'loans',
    label: 'Lån',
    description: 'Följ saldo, ränta och amortering på bolån och andra lån',
    href: '/settings/loans',
  },
  ccm: {
    id: 'ccm',
    label: 'Kreditkort',
    description: 'Håll kortköp separat tills fakturan betalas',
    href: '/settings/ccm',
  },
  receipts: {
    id: 'receipts',
    label: 'Kvitton',
    description: 'Spara matkvitton och följ hur priserna ändras',
    href: '/receipts',
  },
  shared: {
    id: 'shared',
    label: 'Gemensam ekonomi',
    description: 'Räkna ut månadens överföringar till ett gemensamt konto',
    href: '/settings/shared-account',
  },
  meals: {
    id: 'meals',
    label: 'Veckomat',
    description: 'Matsedel, recept och inköpslista utifrån veckans erbjudanden',
    href: '/meals',
  },
}

/**
 * Modules in beta: only available when the database grants the feature
 * (profiles.feature_access or a @test.se account, see has_feature_access).
 * Veckomat is run from Claude chat until the app can call the Claude API.
 */
export const GATED_MODULES: Partial<Record<OptionalModule, string>> = {
  meals: 'meals',
}

interface ModuleProfile {
  enabled_modules?: string[] | null
  ccm_enabled?: boolean | null
}

/**
 * Whether a module is on for this profile. Profiles from before module
 * selection (enabled_modules NULL or missing) keep every module. The credit
 * card module is ccm_enabled alone, since the budget math reads that flag.
 */
export function isModuleEnabled(profile: ModuleProfile | null | undefined, module: OptionalModule): boolean {
  if (!profile) return false
  if (module === 'ccm') return !!profile.ccm_enabled
  const enabled = profile.enabled_modules
  if (enabled == null) return true
  return enabled.includes(module)
}

/** Maps an app path to the module it belongs to, or null for core pages. */
export function moduleForPath(pathname: string): OptionalModule | null {
  for (const info of Object.values(MODULE_INFO)) {
    if (pathname === info.href || pathname.startsWith(info.href + '/')) return info.id
  }
  return null
}
