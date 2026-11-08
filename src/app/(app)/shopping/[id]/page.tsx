'use client'

import { use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Archive, ArchiveRestore, ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ShoppingItemsList } from '@/components/shopping/shopping-items-list'
import { ShoppingPageSkeleton } from '@/components/shopping/shopping-skeleton'
import {
  useDeleteShoppingList,
  useSetShoppingListArchived,
  useShoppingList,
  useShoppingListItemsRealtime,
} from '@/hooks/use-shopping'

export default function ShoppingListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: list, isLoading } = useShoppingList(id)
  const setArchived = useSetShoppingListArchived()
  const deleteList = useDeleteShoppingList()
  useShoppingListItemsRealtime(id)

  if (isLoading) return <ShoppingPageSkeleton />

  if (!list) {
    return (
      <div className="px-4 md:px-8 pt-4 pb-4 max-w-3xl mx-auto text-center">
        <p className="text-sm text-muted-foreground">Listan finns inte längre.</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href="/shopping">Till Inköpslista</Link>
        </Button>
      </div>
    )
  }

  const archived = !!list.archived_at

  return (
    <div className="px-4 md:px-8 pt-2 md:pt-4 pb-4 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/shopping">
            <ArrowLeft />
            Inköpslista
          </Link>
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setArchived.mutate({ id: list.id, archived: !archived })}
            disabled={setArchived.isPending}
          >
            {archived ? <ArchiveRestore /> : <Archive />}
            {archived ? 'Återställ' : 'Arkivera'}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" aria-label="Ta bort listan">
                <Trash2 />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Ta bort {list.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Listan och alla {list.items.length} varor tas bort för er båda. Det går inte att ångra.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteList.mutate(list.id, { onSuccess: () => router.replace('/shopping') })}
                >
                  Ta bort
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3 px-1">
        <h1 className="font-serif-hero text-[30px] md:text-[36px] leading-[1.1]">{list.name}</h1>
        <Button asChild variant="outline" size="sm">
          <Link href={`/shopping?list=${list.id}`}>
            <Plus />
            Lägg till
          </Link>
        </Button>
      </div>

      {list.items.length === 0 ? (
        <div className="bg-card rounded-3xl p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Listan är tom. Lägg till varor på sidan Inköpslista.</p>
        </div>
      ) : (
        <ShoppingItemsList listId={list.id} items={list.items} />
      )}
    </div>
  )
}
