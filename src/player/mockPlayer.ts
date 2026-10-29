import type { Player } from './types.ts'

/** 소리 없이 곡 길이만큼 시간이 지나면 끝났다고 알려주는 데모용 플레이어입니다. */
export function createMockPlayer(): Player {
    let timer: ReturnType<typeof setTimeout> | undefined

    return {
        play(track, handlers) {
            clearTimeout(timer)
            timer = setTimeout(handlers.onEnded, track.duration)
            return Promise.resolve()
        },
        stop() {
            clearTimeout(timer)
            timer = undefined
        },
    }
}
