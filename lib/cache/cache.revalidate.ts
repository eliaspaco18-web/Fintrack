import 'server-only'

import { revalidatePath, revalidateTag } from 'next/cache'
import { InvalidationMap, RevalidationPaths } from '@/lib/cache/cache.config'

type MutationKey = keyof typeof InvalidationMap

/** Server-only cache invalidation helper for financial mutations. */
export function revalidateAfterMutation(
  mutation: MutationKey,
  extraPaths: string[] = [],
): void {
  for (const tag of InvalidationMap[mutation]) {
    // expire: 0 preserves the previous immediate-invalidation behavior.
    revalidateTag(tag, { expire: 0 })
  }

  const paths = [
    ...(RevalidationPaths[mutation as keyof typeof RevalidationPaths] ?? []),
    ...extraPaths,
  ]
  for (const path of paths) revalidatePath(path)
}
