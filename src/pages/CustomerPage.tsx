import { useState } from 'react'
import { toApiError, type Api } from '../api/client.ts'
import type { TrackWithStatus } from '../api/types.ts'
import Alert from '../components/Alert.tsx'
import InfiniteSentinel from '../components/InfiniteSentinel.tsx'
import InvalidAccess from '../components/InvalidAccess.tsx'
import NowPlaying from '../components/NowPlaying.tsx'
import QueueList from '../components/QueueList.tsx'
import Toast from '../components/Toast.tsx'
import TrackRow from '../components/TrackRow.tsx'
import { useDebouncedValue } from '../hooks/useDebouncedValue.ts'
import { usePolling } from '../hooks/usePolling.ts'
import { useToast } from '../hooks/useToast.ts'
import { useTrackList } from '../hooks/useTrackList.ts'
import { messageFor } from '../lib/errorMessage.ts'
import { getClientId } from '../lib/identity.ts'

type Props = { api: Api; storeId: string }

/** 고객 화면입니다. 매장 QR 코드로 들어와 재생 중인 곡과 대기열을 보고, 곡을 찾아 신청해요. */
export default function CustomerPage({ api, storeId }: Props) {
    const [clientId] = useState(getClientId)
    const [query, setQuery] = useState('')
    const [requestingId, setRequestingId] = useState<string>()
    const searchQuery = useDebouncedValue(query.trim(), 300)
    const { toast, show } = useToast()

    const queue = usePolling((signal) => api.getQueue(clientId, signal))
    // 재생 중인 곡이나 대기열이 바뀌면 곡마다 붙은 신청 상태도 바뀌므로, 목록을 새로 불러오는 신호로 써요.
    const signature = queue.data
        ? `${queue.data.nowPlaying?.track.spotifyId ?? ''}|${queue.data.queue.map((entry) => entry.queueId).join(',')}`
        : ''
    const list = useTrackList(api, searchQuery, signature)

    if (queue.error?.code === 'STORE_NOT_FOUND') return <InvalidAccess />

    // 내가 신청한 곡이 대기 중이면(mine) 다음 곡을 신청할 수 없어요. 재생 중인 곡은 대기 중으로 보지 않아요.
    const canRequest = queue.data !== undefined && !queue.data.queue.some((entry) => entry.mine)

    const request = async (track: TrackWithStatus) => {
        setRequestingId(track.spotifyId)
        try {
            await api.enqueue(clientId, track.spotifyId)
            show(`신청했어요 · ${track.title}`)
        } catch (caught) {
            show(messageFor(toApiError(caught)), 'error')
        } finally {
            setRequestingId(undefined)
            // 성공이든 실패든 서버의 최신 상태를 바로 보여줘요.
            queue.reload()
            list.reload()
        }
    }

    const heading = searchQuery ? `“${searchQuery}” 검색 결과` : '지금 신청할 수 있는 곡'

    return (
        <>
            <div className="mx-auto w-full px-4 py-6 medium:max-w-[720px] medium:px-6 expanded:max-w-[1120px] large:max-w-[1280px] xlarge:max-w-[1520px]">
                <header className="mb-5 flex items-baseline justify-between gap-3">
                    <h1 className="text-3xl font-extrabold tracking-tight">스마트 주크박스</h1>
                    <span className="text-sm text-mute">매장 {storeId}</span>
                </header>

                {queue.error && (
                    <div className="mb-4">
                        <Alert>{messageFor(queue.error)}</Alert>
                    </div>
                )}

                <div className="grid gap-4 expanded:grid-cols-[360px_1fr] expanded:items-start expanded:gap-8 large:grid-cols-[400px_1fr] xlarge:grid-cols-[440px_1fr]">
                    <aside className="space-y-4 expanded:sticky expanded:top-6 expanded:max-h-[calc(100svh-3rem)] expanded:overflow-y-auto">
                        {queue.data && queue.receivedAt !== undefined ? (
                            <NowPlaying
                                nowPlaying={queue.data.nowPlaying}
                                serverTime={queue.data.serverTime}
                                receivedAt={queue.receivedAt}
                            />
                        ) : (
                            <p className="rounded-[14px] border border-line bg-card p-4 text-mute">
                                불러오는 중이에요…
                            </p>
                        )}
                        <QueueList queue={queue.data?.queue ?? []} />
                    </aside>

                    <section aria-label="곡 신청" className="min-w-0 space-y-3">
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="제목이나 아티스트로 찾아봐요"
                            aria-label="곡 검색"
                            className="block w-full rounded-[10px] border border-line bg-card px-3 py-3 text-ink placeholder:text-mute"
                        />

                        <h2 className="px-1 text-sm text-mute">
                            {heading}
                            {!list.loading && (
                                <>
                                    {' '}
                                    · <span className="tabular-nums">{list.total}</span>곡
                                </>
                            )}
                        </h2>

                        {!canRequest && queue.data && (
                            <p className="px-1 text-sm text-mute">
                                내가 신청한 곡이 대기 중이라, 그 곡이 재생된 뒤에 다음 곡을 신청할 수 있어요.
                            </p>
                        )}

                        {list.error && (
                            <div className="space-y-2">
                                <Alert>{messageFor(list.error)}</Alert>
                                <button
                                    type="button"
                                    onClick={list.reload}
                                    className="min-h-11 rounded-[10px] border border-line bg-card px-4 font-bold"
                                >
                                    다시 불러오기
                                </button>
                            </div>
                        )}

                        {list.loading && <p className="px-1 text-mute">불러오는 중이에요…</p>}

                        {!list.loading && !list.error && list.tracks.length === 0 && (
                            <p className="rounded-[14px] border border-line bg-card p-6 text-center text-mute">
                                {searchQuery
                                    ? '찾는 곡이 없어요. 다른 검색어로 찾아보세요.'
                                    : '지금 신청할 수 있는 곡이 없어요.'}
                            </p>
                        )}

                        {list.tracks.length > 0 && (
                            <ul className="overflow-hidden rounded-[14px] border border-line bg-card xlarge:grid xlarge:grid-cols-2 [&>li:last-child]:border-b-0">
                                {list.tracks.map((track) => (
                                    <TrackRow
                                        key={track.spotifyId}
                                        track={track}
                                        canRequest={canRequest}
                                        requesting={requestingId === track.spotifyId}
                                        onRequest={request}
                                    />
                                ))}
                            </ul>
                        )}

                        {list.hasMore && <InfiniteSentinel onVisible={list.loadMore} version={list.tracks.length} />}
                        {list.loadingMore && <p className="px-1 text-center text-sm text-mute">더 불러오는 중이에요…</p>}
                    </section>
                </div>
            </div>
            <Toast toast={toast} />
        </>
    )
}
