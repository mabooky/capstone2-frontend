import type { Track } from '../api/types.ts'

export type PlayHandlers = {
    /** 곡이 끝까지 재생되면 호출돼요. */
    onEnded: () => void
    /** 재생 도중 재생할 수 없게 되면 호출돼요. */
    onError: (message: string) => void
}

/** 곡을 실제로 재생하는 쪽입니다. 소리 없는 모의 플레이어와 Spotify 플레이어가 같은 모양을 따라요. */
export type Player = {
    /** 곡을 처음부터 재생합니다. 재생을 시작하지 못하면 거부돼요. */
    play(track: Track, handlers: PlayHandlers): Promise<void>
    /** 재생 중인 곡을 멈추고, 아직 호출되지 않은 콜백은 취소합니다. */
    stop(): void
}
