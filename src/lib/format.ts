/** 밀리초를 m:ss로 바꿉니다. (예: 199000 → 3:19) */
export function formatDuration(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = String(totalSeconds % 60).padStart(2, '0')
    return `${minutes}:${seconds}`
}
