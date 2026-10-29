import { useEffect, useState } from 'react'

export type ToastMessage = { id: number; text: string; tone: 'info' | 'error' }

/** 잠깐 보였다가 사라지는 안내입니다. 새 안내가 오면 이전 안내를 대신합니다. */
export function useToast(durationMs = 3500) {
    const [toast, setToast] = useState<ToastMessage>()

    useEffect(() => {
        if (!toast) return
        const timer = setTimeout(() => setToast(undefined), durationMs)
        return () => clearTimeout(timer)
    }, [toast, durationMs])

    return {
        toast,
        show: (text: string, tone: ToastMessage['tone'] = 'info') =>
            setToast((previous) => ({ id: (previous?.id ?? 0) + 1, text, tone })),
    }
}
