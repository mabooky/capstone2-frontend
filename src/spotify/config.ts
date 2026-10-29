/** Spotify 앱의 Client ID입니다. 공개되어도 되는 값이며, 설정하지 않으면 Spotify 연결을 쓸 수 없어요. */
export const SPOTIFY_CLIENT_ID: string | undefined =
    (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined)?.trim() || undefined

/** Spotify 로그인을 마친 뒤 돌아오는 경로입니다. 대시보드에 등록한 Redirect URI의 경로와 같아야 해요. */
export const SPOTIFY_CALLBACK_PATH = '/auth/spotify/callback'

/** 로그인 뒤에 돌아오는 전체 주소입니다. 대시보드에 등록한 값과 정확히 같아야 해요. */
export const spotifyRedirectUri = () => `${location.origin}${SPOTIFY_CALLBACK_PATH}`

export const isSpotifyCallbackPath = (pathname: string) => pathname.replace(/\/+$/, '') === SPOTIFY_CALLBACK_PATH

/** 브라우저에서 재생하고(streaming) 재생 기기를 다루는 데 필요한 권한입니다. */
export const SPOTIFY_SCOPES = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-modify-playback-state',
    'user-read-playback-state',
]
