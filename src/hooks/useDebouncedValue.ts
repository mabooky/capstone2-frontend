import { useEffect, useState } from 'react'

/** value가 delayMs 동안 바뀌지 않으면 그 값을 돌려줍니다. 검색어 입력처럼 잦은 변경에 씁니다. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delayMs)
        return () => clearTimeout(timer)
    }, [value, delayMs])
    return debounced
}
