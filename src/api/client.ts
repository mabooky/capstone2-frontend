import type {
    ErrorCode,
    MeStatus,
    Mood,
    NowPlayingEntry,
    QueueEntry,
    QueueSnapshot,
    SearchResult,
    Track,
    TrackWithStatus,
} from './types.ts'

/** 서버의 에러 응답이나 네트워크 오류를 화면에서 한 가지 형태로 다루기 위한 오류입니다. */
export class ApiError extends Error {
    readonly status: number
    readonly code: ErrorCode
    /** 429 TRACK_COOLDOWN에서만 있으며, 다시 신청할 수 있을 때까지 남은 초입니다. */
    readonly retryAfterSec?: number

    constructor(status: number, code: ErrorCode, message: string, retryAfterSec?: number) {
        super(message)
        this.status = status
        this.code = code
        this.retryAfterSec = retryAfterSec
    }
}

/** catch로 잡은 값을 화면에서 다루기 쉬운 ApiError로 바꿉니다. */
export function toApiError(caught: unknown): ApiError {
    return caught instanceof ApiError ? caught : new ApiError(0, 'UNKNOWN', '알 수 없는 오류가 발생했어요.')
}

type RequestOptions = {
    body?: unknown
    clientId?: string
    token?: string
    signal?: AbortSignal
}

type ErrorBody = { error?: { code?: unknown; message?: unknown; retryAfterSec?: unknown } }

function isAbort(error: unknown): boolean {
    return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError'
}

async function request<T>(baseUrl: string, method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {}
    if (options.body !== undefined) headers['Content-Type'] = 'application/json'
    if (options.clientId) headers['X-Client-Id'] = options.clientId
    if (options.token) headers.Authorization = `Bearer ${options.token}`

    let response: Response
    try {
        response = await fetch(baseUrl + path, {
            method,
            headers,
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
            signal: options.signal,
        })
    } catch (error) {
        if (isAbort(error)) throw error
        throw new ApiError(0, 'NETWORK_ERROR', '서버에 연결하지 못했어요.')
    }

    if (response.status === 204) return undefined as T

    // JSON이 아닌 응답(HTML 404 등)이 오는 경우를 함께 처리합니다.
    let data: unknown
    try {
        data = JSON.parse(await response.text())
    } catch {
        data = undefined
    }

    if (!response.ok) {
        const body = (data as ErrorBody | undefined)?.error
        if (body && typeof body.code === 'string') {
            throw new ApiError(
                response.status,
                body.code as ErrorCode,
                typeof body.message === 'string' ? body.message : '',
                typeof body.retryAfterSec === 'number' ? body.retryAfterSec : undefined,
            )
        }
        throw new ApiError(response.status, 'UNKNOWN', '서버가 예상하지 못한 응답을 보냈어요.')
    }
    if (data === undefined) throw new ApiError(response.status, 'UNKNOWN', '서버가 예상하지 못한 응답을 보냈어요.')
    return data as T
}

/** 한 매장에 대한 API 호출 모음입니다. apiBase는 서버 주소(경로 없음)입니다. */
export function createApi(apiBase: string, storeId: string) {
    const base = `${apiBase}/api/stores/${encodeURIComponent(storeId)}`
    const call = <T>(method: string, path: string, options?: RequestOptions) => request<T>(base, method, path, options)

    return {
        // ---- 공개 API ----
        getMood: (signal?: AbortSignal) => call<Mood>('GET', '/mood', { signal }),
        getCatalog: (signal?: AbortSignal) => call<TrackWithStatus[]>('GET', '/catalog', { signal }),
        search: (q: string, options: { limit?: number; offset?: number; signal?: AbortSignal } = {}) => {
            const query = new URLSearchParams({ q })
            if (options.limit !== undefined) query.set('limit', String(options.limit))
            if (options.offset !== undefined) query.set('offset', String(options.offset))
            return call<SearchResult>('GET', `/search?${query}`, { signal: options.signal })
        },
        getQueue: (clientId?: string, signal?: AbortSignal) => call<QueueSnapshot>('GET', '/queue', { clientId, signal }),
        enqueue: (clientId: string, spotifyId: string) =>
            call<QueueEntry>('POST', '/queue', { clientId, body: { spotifyId } }),
        getMe: (clientId: string, signal?: AbortSignal) => call<MeStatus>('GET', '/me', { clientId, signal }),

        // ---- 관리자 API ----
        login: (password: string) => call<{ token: string }>('POST', '/admin/login', { body: { password } }),
        setMood: (token: string, mood: { valence: number; arousal: number; n?: number }) =>
            call<TrackWithStatus[]>('PUT', '/admin/mood', { token, body: mood }),
        previewMood: (
            token: string,
            point: { valence: number; arousal: number; n?: number },
            signal?: AbortSignal,
        ) => {
            const query = new URLSearchParams({ valence: String(point.valence), arousal: String(point.arousal) })
            if (point.n !== undefined) query.set('n', String(point.n))
            return call<Track[]>('GET', `/admin/mood/preview?${query}`, { token, signal })
        },
        getFallbackTrack: (token: string) => call<Track>('GET', '/admin/fallback-track', { token }),
        reportNowPlaying: (token: string, spotifyId: string) =>
            call<{ nowPlaying: NowPlayingEntry }>('PUT', '/admin/now-playing', { token, body: { spotifyId } }),
        removeQueueItem: (token: string, queueId: string) =>
            call<void>('DELETE', `/admin/queue/${encodeURIComponent(queueId)}`, { token }),
    }
}

export type Api = ReturnType<typeof createApi>
