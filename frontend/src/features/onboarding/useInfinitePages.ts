import { useCallback, useEffect, useRef, useState } from 'react'

interface Page<T> {
  items: T[]
  nextCursor: string | null
}

const MAX_AUTO_CONTINUE = 4

// Generic "keep growing as you scroll" pager for onboarding's suggestion
// grids (WatchedStep/CelebritiesStep) — both are backed by the same shape of
// cursor-paginated endpoint (onboarding.service.ts's TMDB Discover paging),
// just with a different item type and id.
//
// Auto-continues (bounded) past a page that came back with zero *new* items
// but still has a nextCursor — a genre/language Discover page can legitimately
// contribute nothing new (everything on it already seen, or filtered out by
// the in-app language cross-check), and without this, both the first load and
// a manual loadMore() would silently do nothing instead of finding the next
// page that actually has something.
export function useInfinitePages<T>(fetchPage: (cursor: string | null) => Promise<Page<T>>, getId: (item: T) => string) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const seenIds = useRef(new Set<string>())
  const mountedRef = useRef(true)

  const appendPage = useCallback(
    (page: Page<T>) => {
      const fresh = page.items.filter((it) => !seenIds.current.has(getId(it)))
      fresh.forEach((it) => seenIds.current.add(getId(it)))
      if (fresh.length > 0) setItems((prev) => [...prev, ...fresh])
      setNextCursor(page.nextCursor)
      return fresh.length
    },
    [getId]
  )

  // Loops until a page actually adds something new, or there's nowhere left
  // to go — a local `cursor` variable drives the loop rather than re-reading
  // the `nextCursor` state, since setState updates aren't visible until the
  // next render.
  const fetchUntilNonEmpty = useCallback(
    async (startCursor: string | null) => {
      let cursor = startCursor
      for (let attempt = 0; attempt < MAX_AUTO_CONTINUE; attempt++) {
        const page = await fetchPage(cursor)
        if (!mountedRef.current) return
        const added = appendPage(page)
        cursor = page.nextCursor
        if (added > 0 || !cursor) return
      }
    },
    [fetchPage, appendPage]
  )

  useEffect(() => {
    mountedRef.current = true
    setLoading(true)
    fetchUntilNonEmpty(null)
      .catch((err) => {
        if (mountedRef.current) setError(err instanceof Error ? err.message : 'Failed to load')
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false)
      })
    return () => {
      mountedRef.current = false
    }
    // Intentionally runs once on mount — fetchPage closes over this step's
    // own genres/languages, already final by the time it's reached.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || nextCursor === null) return
    setLoadingMore(true)
    try {
      await fetchUntilNonEmpty(nextCursor)
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'Failed to load more')
    } finally {
      if (mountedRef.current) setLoadingMore(false)
    }
  }, [fetchUntilNonEmpty, loadingMore, loading, nextCursor])

  return { items, loading, loadingMore, error, hasMore: nextCursor !== null, loadMore }
}
