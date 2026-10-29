import { useEffect, useRef, useState } from 'react'
import { toApiError, type Api, type ApiError } from '../api/client.ts'
import type { QueueSnapshot, Track } from '../api/types.ts'
import { messageFor } from '../lib/errorMessage.ts'
import type { Player } from '../player/types.ts'

/** 곡을 정하고 보고하고 재생하는 일을 이만큼 시도해도 안 되면 멈춰요. */
const MAX_ATTEMPTS = 5
const RETRY_DELAY_MS = 3000

export type PlaybackStatus = 'idle' | 'starting' | 'playing'

/** resume은 관리자가 다시 접속했을 때(서버의 재생 상태를 이어받음), next는 한 곡이 끝나 다음 곡으로 넘어갈 때입니다. */
type Mode = 'resume' | 'next'

type Options = {
    api: Api
    token: string
    player: Player
    /** 관리자 API가 401을 돌려주면 호출돼요. */
    onUnauthorized: (error: ApiError) => void
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * 관리자 재생을 이끄는 흐름입니다. 다음에 재생할 곡을 클라이언트가 정하고, 서버에 보고가 성공한 뒤에 재생해요.
 * 곡이 끝나면 같은 과정을 되풀이하며, 곡마다 한 번만 넘어가도록 번호(runRef)로 중복 종료를 걸러냅니다.
 */
export function usePlayback({ api, token, player, onUnauthorized }: Options) {
    const [status, setStatus] = useState<PlaybackStatus>('idle')
    const [message, setMessage] = useState<string>()
    const runRef = useRef(0)

    useEffect(
        () => () => {
            // 화면을 떠나면 진행 중이던 흐름과 재생을 모두 끝내요.
            runRef.current++
            player.stop()
        },
        [player],
    )

    /** 재생할 곡을 정합니다. 명세의 "관리자 재접속 절차"와 같은 규칙이에요. */
    const choose = async (snapshot: QueueSnapshot, mode: Mode): Promise<Track> => {
        const nowPlaying = snapshot.nowPlaying
        if (mode === 'resume' && nowPlaying) {
            if (nowPlaying.source === 'request') return nowPlaying.track
            return snapshot.queue.length > 0 ? snapshot.queue[0].track : nowPlaying.track
        }
        if (snapshot.queue.length > 0) return snapshot.queue[0].track
        return api.getFallbackTrack(token)
    }

    const advance = async (mode: Mode): Promise<void> => {
        const run = ++runRef.current
        const stale = () => runRef.current !== run
        player.stop()
        setStatus('starting')
        setMessage(undefined)

        let nextMode = mode
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            try {
                const snapshot = await api.getQueue()
                if (stale()) return
                const track = await choose(snapshot, nextMode)
                if (stale()) return

                // 보고가 성공한 뒤에 재생해야, 중간에 끊겨도 서버 상태와 실제 재생이 어긋나지 않아요.
                const { nowPlaying } = await api.reportNowPlaying(token, track.spotifyId)
                if (stale()) return
                nextMode = 'next'

                try {
                    await player.play(nowPlaying.track, {
                        onEnded: () => {
                            if (!stale()) void advance('next')
                        },
                        onError: () => {
                            if (stale()) return
                            setMessage('재생하지 못한 곡이 있어서 건너뛰었어요.')
                            void advance('next')
                        },
                    })
                } catch {
                    // 재생할 수 없는 곡이면 건너뛰고 다음 곡을 보고해요.
                    if (stale()) return
                    setMessage('재생하지 못한 곡이 있어서 건너뛰었어요.')
                    continue
                }
                if (stale()) return
                setStatus('playing')
                return
            } catch (caught) {
                if (stale()) return
                const error = toApiError(caught)
                if (error.code === 'UNAUTHORIZED') {
                    setStatus('idle')
                    onUnauthorized(error)
                    return
                }
                if (error.code === 'NO_TRACKS') {
                    setStatus('idle')
                    setMessage(messageFor(error))
                    return
                }
                if (
                    error.code === 'NOT_NEXT_IN_QUEUE' ||
                    error.code === 'OUT_OF_MOOD' ||
                    error.code === 'TRACK_NOT_FOUND'
                ) {
                    // 대기열이 그새 바뀌었거나 고른 곡이 맞지 않으면, 서버 상태를 다시 읽고 곡을 새로 정해요.
                    nextMode = 'next'
                    continue
                }
                // 네트워크 오류 같은 일시적인 문제는 잠시 기다렸다가 다시 시도해요.
                await sleep(RETRY_DELAY_MS)
                if (stale()) return
            }
        }
        setStatus('idle')
        setMessage('재생을 이어가지 못했어요. 잠시 뒤에 다시 시작해 주세요.')
    }

    return {
        status,
        message,
        /** 재생을 시작하거나 서버의 재생 상태를 이어받아 재개해요. 브라우저의 자동 재생 정책 때문에 버튼으로 호출해야 해요. */
        start: () => void advance('resume'),
        /** 지금 곡을 건너뛰고 다음 곡을 보고해요. */
        skip: () => void advance('next'),
        /** 이 화면에서의 재생을 멈춰요. 서버에 마지막으로 보고한 곡은 그대로 남아요. */
        stop: () => {
            runRef.current++
            player.stop()
            setStatus('idle')
            setMessage(undefined)
        },
    }
}
