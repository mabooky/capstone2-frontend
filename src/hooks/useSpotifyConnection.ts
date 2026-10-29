import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { createSpotifyPlayer } from '../player/spotifyPlayer.ts'
import type { Player } from '../player/types.ts'
import {
    beginSpotifyLogin,
    clearSpotifyTokens,
    getSpotifyAccessToken,
    hasSpotifyTokens,
    SpotifyAuthError,
} from '../spotify/auth.ts'
import { SPOTIFY_CLIENT_ID } from '../spotify/config.ts'
import { loadSpotifySdk } from '../spotify/sdk.ts'
import { transferPlayback } from '../spotify/webApi.ts'

export type SpotifyStatus = 'unavailable' | 'disconnected' | 'connecting' | 'ready' | 'error'

/**
 * Spotify 연결 상태입니다. 로그인한 적이 있으면 화면을 열 때 자동으로 연결하고,
 * 기기가 준비되면(ready) 이 브라우저에서 재생할 수 있는 player를 돌려줘요. 그 전에는 player가 null이에요.
 */
export function useSpotifyConnection(storeId: string) {
    const [status, setStatus] = useState<SpotifyStatus>(() =>
        !SPOTIFY_CLIENT_ID ? 'unavailable' : hasSpotifyTokens() ? 'connecting' : 'disconnected',
    )
    const [message, setMessage] = useState<string>()
    const [player, setPlayer] = useState<Player | null>(null)
    const sdkRef = useRef<Spotify.Player | null>(null)

    const fail = (text: string) => {
        setPlayer(null)
        setMessage(text)
        setStatus('error')
    }

    /** SDK 플레이어를 만들어 연결합니다. isCancelled가 true를 돌려주면 하던 일을 멈춰요. */
    const startSdk = async (isCancelled: () => boolean) => {
        try {
            await loadSpotifySdk()
        } catch {
            if (!isCancelled()) fail('Spotify SDK를 불러오지 못했어요. 광고 차단 확장 프로그램이 막고 있는지 확인해 주세요.')
            return
        }
        if (isCancelled()) return

        const sdk = new Spotify.Player({
            name: `스마트 주크박스 · 매장 ${storeId}`,
            getOAuthToken: (callback) => {
                void getSpotifyAccessToken().then((token) => {
                    if (token) callback(token)
                    else if (!isCancelled()) fail('Spotify 로그인이 만료됐어요. 다시 연결해 주세요.')
                })
            },
            volume: 0.8,
        })
        sdkRef.current = sdk

        sdk.addListener('ready', ({ device_id }) => {
            if (isCancelled()) return
            // 이 브라우저를 재생 기기로 삼아요. 실패해도 재생 요청에 기기를 지정하므로 계속 진행해요.
            void transferPlayback(device_id)
                .catch(() => {})
                .then(() => {
                    if (isCancelled()) return
                    setPlayer(createSpotifyPlayer(sdk, device_id))
                    setMessage(undefined)
                    setStatus('ready')
                })
        })
        sdk.addListener('not_ready', () => {
            if (!isCancelled()) fail('Spotify 재생 기기가 오프라인이 됐어요. 다시 연결해 주세요.')
        })
        sdk.addListener('initialization_error', () => {
            if (!isCancelled()) fail('이 브라우저에서는 Spotify로 재생할 수 없어요. 최신 Chrome에서 열어 주세요.')
        })
        sdk.addListener('authentication_error', () => {
            clearSpotifyTokens()
            if (!isCancelled()) fail('Spotify 로그인이 만료됐어요. 다시 연결해 주세요.')
        })
        sdk.addListener('account_error', () => {
            if (!isCancelled()) fail('Spotify Premium 계정이 필요해요.')
        })

        const connected = await sdk.connect()
        if (!connected && !isCancelled()) fail('Spotify에 연결하지 못했어요. 잠시 뒤에 다시 시도해 주세요.')
    }

    // 화면을 열 때 이미 로그인한 적이 있으면 자동으로 연결해요. (status의 처음 값이 이미 connecting이에요.)
    const autoConnect = useEffectEvent(startSdk)
    useEffect(() => {
        if (!SPOTIFY_CLIENT_ID || !hasSpotifyTokens()) return
        let cancelled = false
        void autoConnect(() => cancelled)
        return () => {
            cancelled = true
            sdkRef.current?.disconnect()
            sdkRef.current = null
        }
    }, [])

    const connect = () => {
        setMessage(undefined)
        if (!hasSpotifyTokens()) {
            // 로그인한 적이 없으면 Spotify 로그인 화면으로 나갔다가 돌아와요.
            void beginSpotifyLogin(storeId).catch((caught: unknown) => {
                fail(caught instanceof SpotifyAuthError ? caught.message : 'Spotify 로그인을 시작하지 못했어요.')
            })
            return
        }
        sdkRef.current?.disconnect()
        setPlayer(null)
        setStatus('connecting')
        void startSdk(() => false)
    }

    const disconnect = () => {
        sdkRef.current?.disconnect()
        sdkRef.current = null
        clearSpotifyTokens()
        setPlayer(null)
        setMessage(undefined)
        setStatus('disconnected')
    }

    /** 브라우저의 자동 재생 정책 때문에, 재생 버튼을 누르는 순간에 호출해서 소리를 낼 수 있게 해요. */
    const activate = () => {
        void sdkRef.current?.activateElement().catch(() => {})
    }

    return { status, message, player, connect, disconnect, activate }
}

export type SpotifyConnection = ReturnType<typeof useSpotifyConnection>
