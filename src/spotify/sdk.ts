const SDK_URL = 'https://sdk.scdn.co/spotify-player.js'

let loading: Promise<void> | undefined

/** Spotify Web Playback SDK 스크립트를 한 번만 불러옵니다. 불러오면 전역의 Spotify를 쓸 수 있어요. */
export function loadSpotifySdk(): Promise<void> {
    loading ??= new Promise<void>((resolve, reject) => {
        if (window.Spotify) {
            resolve()
            return
        }
        // SDK가 준비되면 이 함수를 불러줘요.
        window.onSpotifyWebPlaybackSDKReady = () => resolve()
        const script = document.createElement('script')
        script.src = SDK_URL
        script.async = true
        script.onerror = () => {
            loading = undefined
            reject(new Error('Spotify SDK를 불러오지 못했어요.'))
        }
        document.head.append(script)
    })
    return loading
}
