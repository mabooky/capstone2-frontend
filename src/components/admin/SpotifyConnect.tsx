import type { SpotifyConnection } from '../../hooks/useSpotifyConnection.ts'
import Alert from '../Alert.tsx'

type Props = {
    connection: SpotifyConnection
    /** 재생 중이거나 곡을 준비하는 중이면 true입니다. 이때는 연결을 바꿀 수 없어요. */
    busy: boolean
}

const DESCRIPTION: Record<SpotifyConnection['status'], string> = {
    unavailable: 'Spotify 설정이 없어서 소리 없이 데모로 재생해요.',
    disconnected:
        'Spotify를 연결하면 이 브라우저에서 실제로 곡을 재생해요. 연결하지 않으면 소리 없이 곡 길이만큼 재생 상태만 진행하는 데모로 재생해요. Spotify Premium 계정이 필요해요.',
    connecting: 'Spotify에 연결하는 중이에요…',
    ready: 'Spotify로 재생해요. 이 브라우저가 재생 기기로 연결됐어요.',
    error: '지금은 소리 없이 데모로 재생해요. 아래 문제를 해결한 뒤 다시 연결해 주세요.',
}

/** 소리를 실제로 낼지(Spotify), 소리 없이 데모로 재생할지 정하는 영역입니다. */
export default function SpotifyConnect({ connection, busy }: Props) {
    const { status, message, connect, disconnect } = connection
    const connected = status === 'ready'

    return (
        <section aria-label="소리 재생" className="glass space-y-3 rounded-[24px] p-4 medium:p-5">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm text-mute">소리 재생</h2>
                <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        connected ? 'bg-acc text-accink' : 'border border-line text-mute'
                    }`}
                >
                    {connected ? 'Spotify' : '데모 · 소리 없음'}
                </span>
            </div>

            <p className="text-sm">{DESCRIPTION[status]}</p>

            {status === 'error' && message && <Alert>{message}</Alert>}

            {status !== 'unavailable' && status !== 'connecting' && (
                <div className="flex flex-wrap gap-2">
                    {!connected && (
                        <button
                            type="button"
                            onClick={connect}
                            disabled={busy}
                            className="btn btn-primary"
                        >
                            {status === 'error' ? '다시 연결' : 'Spotify 연결'}
                        </button>
                    )}
                    {(connected || status === 'error') && (
                        <button
                            type="button"
                            onClick={disconnect}
                            disabled={busy}
                            className="btn btn-glass"
                        >
                            연결 해제
                        </button>
                    )}
                </div>
            )}

            {busy && status !== 'unavailable' && (
                <p className="text-xs text-mute">재생을 멈춘 뒤에 연결을 바꿀 수 있어요.</p>
            )}
        </section>
    )
}
