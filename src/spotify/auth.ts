import { SPOTIFY_CLIENT_ID, SPOTIFY_SCOPES, spotifyRedirectUri } from './config.ts'

// Authorization Code + PKCE 방식입니다. 브라우저에는 Client Secret이 없고, 대신 로그인할 때마다 새로 만드는
// code_verifier로 코드를 토큰으로 바꿔요.

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const TOKENS_KEY = 'jukebox.spotify.tokens'
const PENDING_KEY = 'jukebox.spotify.pending'
/** 만료되기 이만큼 전부터는 토큰을 새로 받아요. */
const REFRESH_MARGIN_MS = 60_000

type Tokens = { accessToken: string; refreshToken: string; expiresAt: number }
/** 로그인하러 나가기 전에 저장해 두었다가, 돌아왔을 때 꺼내 쓰는 값입니다. */
type Pending = { verifier: string; state: string; storeId: string }

export class SpotifyAuthError extends Error {
    readonly reason: 'config' | 'denied' | 'state' | 'exchange'
    /** 로그인하러 나간 매장입니다. 오류 화면에서 관리자 화면으로 돌아갈 때 써요. */
    readonly storeId?: string

    constructor(reason: SpotifyAuthError['reason'], message: string, storeId?: string) {
        super(message)
        this.reason = reason
        this.storeId = storeId
    }
}

// ---- 저장소 (저장소를 쓸 수 없으면 토큰은 메모리에만 둬요) ----

let memoryTokens: Tokens | null = null

function loadTokens(): Tokens | null {
    try {
        const raw = localStorage.getItem(TOKENS_KEY)
        if (raw) return JSON.parse(raw) as Tokens
    } catch {
        // 저장소를 읽지 못하면 메모리의 값을 써요.
    }
    return memoryTokens
}

function saveTokens(tokens: Tokens): void {
    memoryTokens = tokens
    try {
        localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens))
    } catch {
        // 저장소를 쓸 수 없으면 메모리에만 보관해요.
    }
}

export function clearSpotifyTokens(): void {
    memoryTokens = null
    try {
        localStorage.removeItem(TOKENS_KEY)
    } catch {
        // 저장소를 쓸 수 없으면 할 일이 없어요.
    }
}

export const hasSpotifyTokens = (): boolean => loadTokens() !== null

function loadPending(): Pending | null {
    try {
        const raw = sessionStorage.getItem(PENDING_KEY)
        return raw ? (JSON.parse(raw) as Pending) : null
    } catch {
        return null
    }
}

function clearPending(): void {
    try {
        sessionStorage.removeItem(PENDING_KEY)
    } catch {
        // 저장소를 쓸 수 없으면 할 일이 없어요.
    }
}

// ---- 로그인 ----

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'

function randomString(length: number): string {
    const bytes = crypto.getRandomValues(new Uint8Array(length))
    return Array.from(bytes, (byte) => CHARSET[byte % CHARSET.length]).join('')
}

function base64Url(buffer: ArrayBuffer): string {
    let binary = ''
    for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte)
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Spotify 로그인 주소를 만들고, 돌아왔을 때 필요한 값을 저장해 둡니다. */
export async function buildAuthorizeUrl(storeId: string): Promise<string> {
    if (!SPOTIFY_CLIENT_ID) throw new SpotifyAuthError('config', 'Spotify 설정이 없어서 연결할 수 없어요.')
    // crypto.subtle은 HTTPS나 127.0.0.1 같은 주소에서만 쓸 수 있어요.
    if (typeof crypto.subtle === 'undefined') {
        throw new SpotifyAuthError('config', '이 주소에서는 Spotify에 연결할 수 없어요. 127.0.0.1이나 HTTPS 주소로 열어 주세요.')
    }

    const verifier = randomString(64)
    const challenge = base64Url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
    const state = randomString(16)
    try {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify({ verifier, state, storeId } satisfies Pending))
    } catch {
        throw new SpotifyAuthError('config', '이 브라우저에서는 Spotify에 연결할 수 없어요. 저장소를 사용할 수 있는지 확인해 주세요.')
    }

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: SPOTIFY_CLIENT_ID,
        scope: SPOTIFY_SCOPES.join(' '),
        redirect_uri: spotifyRedirectUri(),
        state,
        code_challenge_method: 'S256',
        code_challenge: challenge,
    })
    return `${AUTHORIZE_URL}?${params}`
}

/** Spotify 로그인 화면으로 이동합니다. */
export async function beginSpotifyLogin(storeId: string): Promise<void> {
    location.assign(await buildAuthorizeUrl(storeId))
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number }

async function exchangeCode(params: URLSearchParams): Promise<string> {
    const pending = loadPending()
    const fail = (reason: SpotifyAuthError['reason'], message: string) =>
        new SpotifyAuthError(reason, message, pending?.storeId)

    if (params.get('error')) {
        clearPending()
        throw fail('denied', 'Spotify 로그인을 허용하지 않았어요.')
    }
    const code = params.get('code')
    if (!SPOTIFY_CLIENT_ID || !pending || !code || params.get('state') !== pending.state) {
        throw fail('state', '로그인 정보를 확인하지 못했어요. 관리자 화면에서 다시 연결해 주세요.')
    }
    // 코드는 한 번만 쓸 수 있으므로, 교환을 시작하기 전에 저장해 둔 값을 지워요.
    clearPending()

    let response: Response
    try {
        response = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: SPOTIFY_CLIENT_ID,
                grant_type: 'authorization_code',
                code,
                redirect_uri: spotifyRedirectUri(),
                code_verifier: pending.verifier,
            }),
        })
    } catch {
        throw fail('exchange', 'Spotify에 연결하지 못했어요. 잠시 뒤에 다시 시도해 주세요.')
    }
    if (!response.ok) throw fail('exchange', 'Spotify 로그인을 마치지 못했어요. 다시 연결해 주세요.')

    const data = (await response.json()) as TokenResponse
    saveTokens({
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? '',
        expiresAt: Date.now() + data.expires_in * 1000,
    })
    return pending.storeId
}

let completing: { query: string; promise: Promise<string> } | undefined

/**
 * 로그인을 마치고 돌아온 주소의 쿼리(code, state, error)를 받아 토큰을 저장하고, 로그인하러 나갔던 매장 ID를 돌려줍니다.
 * 같은 쿼리로는 한 번만 처리하고 결과를 공유해요. (코드는 한 번만 쓸 수 있고, 개발 모드에서는 화면이 두 번 그려지거든요.)
 */
export function completeSpotifyLogin(params: URLSearchParams): Promise<string> {
    const query = params.toString()
    if (completing && completing.query === query) return completing.promise
    const promise = exchangeCode(params)
    completing = { query, promise }
    return promise
}

// ---- 토큰 ----

let refreshing: Promise<string | null> | undefined

async function refreshAccessToken(tokens: Tokens): Promise<string | null> {
    if (!SPOTIFY_CLIENT_ID || !tokens.refreshToken) {
        clearSpotifyTokens()
        return null
    }
    try {
        const response = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: SPOTIFY_CLIENT_ID,
                grant_type: 'refresh_token',
                refresh_token: tokens.refreshToken,
            }),
        })
        if (response.status === 400 || response.status === 401) {
            // 갱신용 토큰이 취소되었거나 만료됐어요. 다시 로그인해야 해요.
            clearSpotifyTokens()
            return null
        }
        if (!response.ok) return null
        const data = (await response.json()) as TokenResponse
        const next: Tokens = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token ?? tokens.refreshToken,
            expiresAt: Date.now() + data.expires_in * 1000,
        }
        saveTokens(next)
        return next.accessToken
    } catch {
        return null
    }
}

/**
 * 쓸 수 있는 액세스 토큰을 돌려줍니다. 만료가 가까우면 새로 받고, 로그인이 필요하면 null이에요.
 * force가 true이면 아직 만료되지 않았어도 새로 받아요.
 */
export async function getSpotifyAccessToken(force = false): Promise<string | null> {
    const tokens = loadTokens()
    if (!tokens) return null
    if (!force && tokens.expiresAt - Date.now() > REFRESH_MARGIN_MS) return tokens.accessToken
    refreshing ??= refreshAccessToken(tokens).finally(() => {
        refreshing = undefined
    })
    return refreshing
}
