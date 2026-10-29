import { useEffect, useEffectEvent, useState } from 'react'
import { toApiError, type Api, type ApiError } from '../api/client.ts'
import type { TrackWithStatus } from '../api/types.ts'

/** 무한 스크롤에서 한 번에 더 불러오는 곡 수입니다. */
const PAGE_SIZE = 30
/** 서버가 한 번에 돌려주는 검색 결과의 상한입니다. */
const MAX_CHUNK = 50

type Result = { query: string; tracks: TrackWithStatus[]; total: number }

/** 처음부터 count곡을 불러옵니다. 서버의 limit 상한을 넘으면 나눠서 한꺼번에 요청합니다. */
async function fetchRange(api: Api, query: string, count: number, signal: AbortSignal): Promise<Result> {
    if (query === '') {
        const tracks = await api.getCatalog(signal)
        return { query, tracks, total: tracks.length }
    }
    const offsets: number[] = []
    for (let offset = 0; offset < count; offset += MAX_CHUNK) offsets.push(offset)
    const pages = await Promise.all(
        offsets.map((offset) => api.search(query, { limit: Math.min(MAX_CHUNK, count - offset), offset, signal })),
    )
    return { query, tracks: pages.flatMap((page) => page.tracks), total: pages[0].total }
}

/**
 * 검색어가 비어 있으면 카탈로그를, 있으면 검색 결과를 돌려줍니다. 검색 결과는 무한 스크롤로 이어서 불러옵니다.
 * signature가 바뀌면(대기열이나 재생 중인 곡이 바뀌면) 지금까지 불러온 곡의 신청 상태를 새로 고칩니다.
 */
export function useTrackList(api: Api, query: string, signature: string) {
    const [result, setResult] = useState<Result>()
    const [error, setError] = useState<ApiError>()
    const [reloadCount, setReloadCount] = useState(0)
    const [loadingMore, setLoadingMore] = useState(false)

    const refresh = useEffectEvent(async (signal: AbortSignal) => {
        const kept = result?.query === query ? result.tracks.length : 0
        try {
            const next = await fetchRange(api, query, Math.max(PAGE_SIZE, kept), signal)
            if (signal.aborted) return
            setResult(next)
            setError(undefined)
        } catch (caught) {
            if (signal.aborted) return
            setError(toApiError(caught))
        }
    })

    useEffect(() => {
        const controller = new AbortController()
        void refresh(controller.signal)
        return () => controller.abort()
    }, [api, query, signature, reloadCount])

    const current = result?.query === query ? result : undefined
    const hasMore = query !== '' && current !== undefined && current.tracks.length < current.total

    const loadMore = async () => {
        if (!current || !hasMore || loadingMore) return
        setLoadingMore(true)
        try {
            const page = await api.search(query, { limit: PAGE_SIZE, offset: current.tracks.length })
            setResult((previous) => {
                if (!previous || previous.query !== query) return previous
                const seen = new Set(previous.tracks.map((track) => track.spotifyId))
                const added = page.tracks.filter((track) => !seen.has(track.spotifyId))
                return { query, total: page.total, tracks: [...previous.tracks, ...added] }
            })
        } catch (caught) {
            setError(toApiError(caught))
        } finally {
            setLoadingMore(false)
        }
    }

    return {
        tracks: current?.tracks ?? [],
        total: current?.total ?? 0,
        /** 현재 검색어의 첫 결과를 아직 받지 못했으면 true입니다. */
        loading: current === undefined && error === undefined,
        loadingMore,
        hasMore,
        error,
        loadMore,
        reload: () => setReloadCount((count) => count + 1),
    }
}
