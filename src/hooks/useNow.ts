import { useEffect, useState } from 'react'

/** intervalMs마다 갱신되는 현재 시각(epoch ms)입니다. 진행 바처럼 시간이 흐르는 표시에 씁니다. */
export function useNow(intervalMs = 1000): number {
    const [now, setNow] = useState(Date.now)
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), intervalMs)
        return () => clearInterval(timer)
    }, [intervalMs])
    return now
}
