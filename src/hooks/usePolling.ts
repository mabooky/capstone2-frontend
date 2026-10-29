import { useEffect, useEffectEvent, useState } from 'react'
import { toApiError, type ApiError } from '../api/client.ts'

type Snapshot<T> = { data: T; receivedAt: number }

/**
 * fetcher를 intervalMs마다 호출해 최신 결과를 돌려줍니다.
 * 이전 요청이 끝나지 않았으면 다음 호출은 건너뛰고, 오류가 나도 마지막으로 받은 data는 유지합니다.
 * receivedAt은 data를 받은 시각(epoch ms)이며, reload를 호출하면 기다리지 않고 바로 다시 불러옵니다.
 */
export function usePolling<T>(fetcher: (signal: AbortSignal) => Promise<T>, intervalMs = 2000) {
    const [snapshot, setSnapshot] = useState<Snapshot<T>>()
    const [error, setError] = useState<ApiError>()
    const [reloadCount, setReloadCount] = useState(0)

    const load = useEffectEvent(async (signal: AbortSignal) => {
        try {
            const next = await fetcher(signal)
            if (signal.aborted) return
            setSnapshot({ data: next, receivedAt: Date.now() })
            setError(undefined)
        } catch (caught) {
            if (signal.aborted) return
            setError(toApiError(caught))
        }
    })

    useEffect(() => {
        const controller = new AbortController()
        let busy = false
        const tick = async () => {
            if (busy) return
            busy = true
            try {
                await load(controller.signal)
            } finally {
                busy = false
            }
        }
        void tick()
        const timer = setInterval(() => void tick(), intervalMs)
        return () => {
            controller.abort()
            clearInterval(timer)
        }
    }, [intervalMs, reloadCount])

    return {
        data: snapshot?.data,
        receivedAt: snapshot?.receivedAt,
        error,
        reload: () => setReloadCount((count) => count + 1),
    }
}
