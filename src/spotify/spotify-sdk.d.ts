// Spotify Web Playback SDK가 전역에 만드는 값 중에서 이 앱이 쓰는 것만 적은 선언입니다.

declare namespace Spotify {
    interface Track {
        uri: string
        id: string | null
        name: string
    }

    interface PlaybackState {
        paused: boolean
        /** 재생 위치(ms)입니다. */
        position: number
        /** 곡 길이(ms)입니다. */
        duration: number
        track_window: {
            current_track: Track
            previous_tracks: Track[]
            next_tracks: Track[]
        }
    }

    interface PlayerError {
        message: string
    }

    interface WebPlaybackInstance {
        device_id: string
    }

    interface PlayerInit {
        name: string
        getOAuthToken: (callback: (token: string) => void) => void
        volume?: number
    }

    class Player {
        constructor(options: PlayerInit)
        connect(): Promise<boolean>
        disconnect(): void
        addListener(event: 'ready' | 'not_ready', callback: (instance: WebPlaybackInstance) => void): boolean
        addListener(event: 'player_state_changed', callback: (state: PlaybackState | null) => void): boolean
        addListener(
            event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error',
            callback: (error: PlayerError) => void,
        ): boolean
        removeListener(event: string, callback?: (...args: never[]) => void): boolean
        pause(): Promise<void>
        activateElement(): Promise<void>
    }
}

interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void
    Spotify?: typeof Spotify
}
