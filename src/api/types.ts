// API 명세(v0.6)의 데이터 타입입니다.

export type RequestStatus =
    | 'available'
    | 'out-of-mood'
    | 'already-queued'
    | 'now-playing'
    | 'recently-played'

export type Track = {
    spotifyId: string
    title: string
    artist: string
    /** 밀리초입니다. */
    duration: number
    albumImageUrl: string
    /** [-1, 1] */
    valence: number
    /** [-1, 1] */
    arousal: number
}

/** 카탈로그와 검색 결과에서만 쓰는, 신청 상태가 붙은 곡입니다. */
export type TrackWithStatus = Track & { requestStatus: RequestStatus }

export type Mood = {
    valence: number
    arousal: number
    /** 가드레일에 포함할 곡 수입니다. (1~100) */
    n: number
}

export type QueueEntry = {
    queueId: string
    track: Track
    requestedAt: number
    /** 요청 헤더의 X-Client-Id가 신청한 곡이면 true입니다. */
    mine: boolean
}

export type NowPlayingEntry = {
    track: Track
    startedAt: number
    /** request는 고객 신청, fallback은 대기열이 비어 자동으로 재생한 곡입니다. */
    source: 'request' | 'fallback'
}

export type QueueSnapshot = {
    serverTime: number
    nowPlaying: NowPlayingEntry | null
    queue: QueueEntry[]
}

export type SearchResult = {
    query: string
    total: number
    tracks: TrackWithStatus[]
}

export type MeStatus = {
    canRequest: boolean
    reason: 'MY_REQUEST_PENDING' | null
}

export type ErrorCode =
    | 'INVALID_INPUT'
    | 'MISSING_CLIENT_ID'
    | 'UNAUTHORIZED'
    | 'INVALID_CREDENTIALS'
    | 'OUT_OF_MOOD'
    | 'STORE_NOT_FOUND'
    | 'TRACK_NOT_FOUND'
    | 'QUEUE_ITEM_NOT_FOUND'
    | 'TRACK_ALREADY_QUEUED'
    | 'MY_REQUEST_PENDING'
    | 'NOT_NEXT_IN_QUEUE'
    | 'NO_TRACKS'
    | 'TRACK_COOLDOWN'
    // 서버 응답이 아니라 클라이언트에서 정하는 코드입니다.
    | 'NETWORK_ERROR'
    | 'UNKNOWN'
