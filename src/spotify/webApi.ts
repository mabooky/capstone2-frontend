import { getSpotifyAccessToken } from './auth.ts'

const API_URL = 'https://api.spotify.com/v1'

/** Spotify Web API가 돌려준 오류입니다. status가 0이면 서버에 닿지 못한 거예요. */
export class SpotifyApiError extends Error {
    readonly status: number

    constructor(status: number, message: string) {
        super(message)
        this.status = status
    }
}

async function call(method: string, path: string, body?: unknown): Promise<void> {
    // 토큰이 만료되어 401이 오면 토큰을 새로 받아 한 번만 다시 시도해요.
    for (let attempt = 0; attempt < 2; attempt++) {
        const token = await getSpotifyAccessToken(attempt > 0)
        if (!token) throw new SpotifyApiError(401, 'Spotify 로그인이 필요해요.')

        let response: Response
        try {
            response = await fetch(API_URL + path, {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
                },
                body: body === undefined ? undefined : JSON.stringify(body),
            })
        } catch {
            throw new SpotifyApiError(0, 'Spotify에 연결하지 못했어요.')
        }
        if (response.status === 401 && attempt === 0) continue
        if (!response.ok) throw new SpotifyApiError(response.status, `Spotify 요청이 실패했어요. (${response.status})`)
        return
    }
}

/** 재생 기기를 이 브라우저로 옮깁니다. 소리는 아직 시작하지 않아요. */
export const transferPlayback = (deviceId: string) =>
    call('PUT', '/me/player', { device_ids: [deviceId], play: false })

/** 이 브라우저(기기)에서 곡을 처음부터 재생합니다. */
export const startTrack = (deviceId: string, spotifyId: string) =>
    call('PUT', `/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
        uris: [`spotify:track:${spotifyId}`],
        position_ms: 0,
    })
