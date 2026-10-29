import type { QueueSnapshot } from '../../api/types.ts'
import type { PlaybackStatus } from '../../hooks/usePlayback.ts'
import NowPlaying from '../NowPlaying.tsx'

type Props = {
    /** 서버가 알고 있는 재생 상태입니다. 아직 받지 못했으면 undefined예요. */
    snapshot: QueueSnapshot | undefined
    receivedAt: number | undefined
    status: PlaybackStatus
    message: string | undefined
    onStart: () => void
    onSkip: () => void
    onStop: () => void
}

const primary = 'min-h-11 rounded-[10px] bg-acc px-5 font-bold text-accink disabled:opacity-40'
const secondary = 'min-h-11 rounded-[10px] border border-line bg-card px-5 font-bold disabled:opacity-40'

/** 지금 재생 중인 곡과 재생 조작 버튼입니다. */
export default function PlayerPanel({ snapshot, receivedAt, status, message, onStart, onSkip, onStop }: Props) {
    // 서버에 재생 중인 곡이 남아 있는데 이 화면은 멈춰 있으면, 관리자가 다시 접속한 것이므로 "재개"라고 안내해요.
    const resuming = status === 'idle' && snapshot?.nowPlaying != null

    return (
        <div className="space-y-3">
            {snapshot && receivedAt !== undefined ? (
                <NowPlaying nowPlaying={snapshot.nowPlaying} serverTime={snapshot.serverTime} receivedAt={receivedAt} />
            ) : (
                <p className="rounded-[14px] border border-line bg-card p-4 text-mute">불러오는 중이에요…</p>
            )}

            <div className="flex flex-wrap gap-2">
                {status === 'idle' ? (
                    <button type="button" onClick={onStart} className={primary}>
                        {resuming ? '재생 재개' : '재생 시작'}
                    </button>
                ) : (
                    <>
                        <button type="button" onClick={onSkip} disabled={status === 'starting'} className={primary}>
                            {status === 'starting' ? '준비 중이에요…' : '건너뛰기'}
                        </button>
                        <button type="button" onClick={onStop} className={secondary}>
                            멈추기
                        </button>
                    </>
                )}
            </div>

            {message && (
                <p role="status" className="rounded-[10px] border border-line bg-card p-3 text-sm text-mute">
                    {message}
                </p>
            )}

            <p className="text-xs text-mute">
                다음 곡은 대기열 맨 앞 곡이고, 대기열이 비어 있으면 서버가 추천한 곡을 자동으로 재생해요.
            </p>
        </div>
    )
}
