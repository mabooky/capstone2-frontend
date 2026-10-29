import { startTrack } from '../spotify/webApi.ts'
import type { Player } from './types.ts'

/** 재생을 요청한 뒤 곡이 실제로 시작되기를 기다리는 시간입니다. 넘으면 재생할 수 없는 곡으로 봐요. */
const START_TIMEOUT_MS = 8000
/** 곡 길이가 지나도 끝났다는 알림이 오지 않을 때를 대비한 여유 시간입니다. */
const END_GRACE_MS = 5000

/**
 * Spotify Web Playback SDK로 이 브라우저에서 곡을 재생하는 플레이어입니다.
 * 곡마다 SDK의 상태 변화를 따로 지켜보다가, 시작을 확인하면 재생이 시작된 것으로, 끝나면 한 번만 onEnded를 알려요.
 */
export function createSpotifyPlayer(sdk: Spotify.Player, deviceId: string): Player {
    // 지금 재생 중인 곡의 감시를 멈추는 함수입니다. 새 곡을 재생하거나 멈출 때 먼저 호출해요.
    let stopWatching: () => void = () => {}

    return {
        async play(track, handlers) {
            stopWatching()
            const trackId = track.spotifyId
            let started = false
            let finished = false
            let startTimer: ReturnType<typeof setTimeout> | undefined
            let endTimer: ReturnType<typeof setTimeout> | undefined
            let markStarted: () => void = () => {}
            let markStartFailed: (error: Error) => void = () => {}
            const startedPromise = new Promise<void>((resolve, reject) => {
                markStarted = resolve
                markStartFailed = reject
            })
            // 시작 확인을 기다리기 전에 실패하더라도 처리되지 않은 거부로 남지 않게 해요.
            startedPromise.catch(() => {})

            const detach = () => {
                clearTimeout(startTimer)
                clearTimeout(endTimer)
                sdk.removeListener('player_state_changed', onState)
                sdk.removeListener('playback_error', onFailure)
                sdk.removeListener('account_error', onFailure)
                sdk.removeListener('authentication_error', onFailure)
            }
            const end = () => {
                if (finished) return
                finished = true
                detach()
                handlers.onEnded()
            }
            const fail = (message: string) => {
                if (finished) return
                finished = true
                detach()
                if (started) handlers.onError(message)
                else markStartFailed(new Error(message))
            }

            function onFailure(error: Spotify.PlayerError) {
                fail(error.message)
            }

            function onState(state: Spotify.PlaybackState | null) {
                if (finished) return
                if (!state) {
                    // 재생 기기와의 연결이 끊겼어요.
                    if (started) fail('Spotify 연결이 끊겼어요.')
                    return
                }
                if (!started) {
                    if (state.track_window.current_track.id === trackId && !state.paused) {
                        started = true
                        clearTimeout(startTimer)
                        endTimer = setTimeout(end, state.duration + END_GRACE_MS)
                        markStarted()
                    }
                    return
                }
                // 곡이 끝까지 재생되면 일시정지 상태로 위치가 0이 되고, 끝난 곡이 이전 곡 목록에 들어가요.
                if (state.paused && state.position === 0 && state.track_window.previous_tracks.some((t) => t.id === trackId)) {
                    end()
                }
            }

            stopWatching = () => {
                finished = true
                detach()
            }
            sdk.addListener('player_state_changed', onState)
            sdk.addListener('playback_error', onFailure)
            sdk.addListener('account_error', onFailure)
            sdk.addListener('authentication_error', onFailure)
            startTimer = setTimeout(() => fail('곡이 시작되지 않았어요.'), START_TIMEOUT_MS)

            try {
                await startTrack(deviceId, trackId)
            } catch (error) {
                stopWatching()
                throw error
            }
            await startedPromise
        },

        stop() {
            stopWatching()
            void sdk.pause().catch(() => {})
        },
    }
}
