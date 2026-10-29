import { useState } from 'react'
import { toApiError, type Api } from '../api/client.ts'
import type { QueueEntry } from '../api/types.ts'
import LoginForm from '../components/admin/LoginForm.tsx'
import MoodPicker from '../components/admin/MoodPicker.tsx'
import PlayerPanel from '../components/admin/PlayerPanel.tsx'
import QueueManager from '../components/admin/QueueManager.tsx'
import SpotifyConnect from '../components/admin/SpotifyConnect.tsx'
import Alert from '../components/Alert.tsx'
import InvalidAccess from '../components/InvalidAccess.tsx'
import Toast from '../components/Toast.tsx'
import { useAdminSession } from '../hooks/useAdminSession.ts'
import { usePlayback } from '../hooks/usePlayback.ts'
import { usePolling } from '../hooks/usePolling.ts'
import { useSpotifyConnection } from '../hooks/useSpotifyConnection.ts'
import { useToast } from '../hooks/useToast.ts'
import { messageFor } from '../lib/errorMessage.ts'
import { createMockPlayer } from '../player/mockPlayer.ts'

type Props = { api: Api; storeId: string }

/** 관리자 화면입니다. 로그인하지 않았으면 로그인 화면을, 로그인했으면 관리 화면을 보여줘요. */
export default function AdminPage({ api, storeId }: Props) {
    const session = useAdminSession(api, storeId)

    if (session.token === null) {
        return <LoginForm storeId={storeId} onLogin={session.login} notice={session.notice} />
    }
    return (
        <AdminConsole
            api={api}
            storeId={storeId}
            token={session.token}
            onLogout={() => session.logout()}
            onUnauthorized={session.handleUnauthorized}
        />
    )
}

type ConsoleProps = {
    api: Api
    storeId: string
    token: string
    onLogout: () => void
    /** 401이면 로그인 화면으로 돌아가고 true를 돌려줘요. */
    onUnauthorized: ReturnType<typeof useAdminSession>['handleUnauthorized']
}

function AdminConsole({ api, storeId, token, onLogout, onUnauthorized }: ConsoleProps) {
    const { toast, show } = useToast()
    const [mockPlayer] = useState(createMockPlayer)
    const spotify = useSpotifyConnection(storeId)
    // Spotify 기기가 준비됐으면 실제로 재생하고, 아니면 소리 없이 데모로 재생해요.
    const player = spotify.player ?? mockPlayer

    const queue = usePolling((signal) => api.getQueue(undefined, signal))
    const mood = usePolling((signal) => api.getMood(signal), 5000)
    const catalog = usePolling((signal) => api.getCatalog(signal), 5000)
    const playback = usePlayback({ api, token, player, onUnauthorized })

    // 브라우저의 자동 재생 정책 때문에, 재생을 시작하는 버튼을 누르는 순간에 Spotify 재생을 열어 둬요.
    const start = () => {
        spotify.activate()
        playback.start()
    }
    const skip = () => {
        spotify.activate()
        playback.skip()
    }

    if (queue.error?.code === 'STORE_NOT_FOUND') return <InvalidAccess />

    const applyMood = async (draft: { valence: number; arousal: number; n: number }) => {
        try {
            await api.setMood(token, draft)
            show('기준점을 바꿨어요. 이미 대기열에 있는 곡은 그대로 남아요.')
            mood.reload()
            catalog.reload()
            return true
        } catch (caught) {
            const error = toApiError(caught)
            if (!onUnauthorized(error)) show(messageFor(error), 'error')
            return false
        }
    }

    const removeFromQueue = async (entry: QueueEntry) => {
        try {
            await api.removeQueueItem(token, entry.queueId)
            show(`대기열에서 뺐어요 · ${entry.track.title}`)
        } catch (caught) {
            const error = toApiError(caught)
            if (!onUnauthorized(error)) show(messageFor(error), 'error')
        } finally {
            queue.reload()
        }
    }

    return (
        <>
            <div className="mx-auto w-full px-4 py-6 medium:max-w-[720px] medium:px-6 expanded:max-w-[1120px] large:max-w-[1280px] xlarge:max-w-[1520px]">
                <header className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
                    <h1 className="text-3xl font-extrabold tracking-tight">관리자</h1>
                    <div className="flex items-center gap-3 text-sm text-mute">
                        <span>매장 {storeId}</span>
                        <button
                            type="button"
                            onClick={onLogout}
                            className="btn btn-glass px-4"
                        >
                            로그아웃
                        </button>
                    </div>
                </header>

                {queue.error && (
                    <div className="mb-4">
                        <Alert>{messageFor(queue.error)}</Alert>
                    </div>
                )}

                <div className="grid items-start gap-4 expanded:grid-cols-[360px_1fr] expanded:gap-8 large:grid-cols-[400px_1fr] xlarge:grid-cols-[440px_1fr]">
                    <div className="space-y-4 expanded:col-start-1">
                        <PlayerPanel
                            snapshot={queue.data}
                            receivedAt={queue.receivedAt}
                            status={playback.status}
                            message={playback.message}
                            onStart={start}
                            onSkip={skip}
                            onStop={playback.stop}
                        />
                        <SpotifyConnect connection={spotify} busy={playback.status !== 'idle'} />
                    </div>

                    <div className="expanded:col-start-2 expanded:row-span-2 expanded:row-start-1">
                        <MoodPicker
                            api={api}
                            token={token}
                            onUnauthorized={onUnauthorized}
                            mood={mood.data}
                            catalog={catalog.data ?? []}
                            onApply={applyMood}
                        />
                    </div>

                    <div className="expanded:col-start-1">
                        <QueueManager queue={queue.data?.queue ?? []} onRemove={removeFromQueue} />
                    </div>
                </div>
            </div>
            <Toast toast={toast} />
        </>
    )
}
