import type { RequestStatus, TrackWithStatus } from '../api/types.ts'
import { formatDuration } from '../lib/format.ts'
import { hueFor } from '../lib/hue.ts'
import Disc from './Disc.tsx'

const STATUS_LABEL: Record<Exclude<RequestStatus, 'available'>, string> = {
    'out-of-mood': '지금 분위기와 달라요',
    'already-queued': '대기 중',
    'now-playing': '재생 중',
    'recently-played': '최근에 재생됐어요',
}

type Props = {
    track: TrackWithStatus
    /** 내가 신청한 곡이 대기 중이 아닐 때만 true입니다. */
    canRequest: boolean
    /** 이 곡을 신청하는 중이면 true입니다. */
    requesting: boolean
    onRequest: (track: TrackWithStatus) => void
}

/** 곡 하나입니다. 신청할 수 있으면 신청 버튼을, 아니면 이유를 보여줘요. */
export default function TrackRow({ track, canRequest, requesting, onRequest }: Props) {
    const available = track.requestStatus === 'available'

    return (
        <li className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-line px-4 py-3 xlarge:odd:border-r">
            <Disc hue={hueFor(track.spotifyId)} className="size-10 shrink-0" />
            <span className="min-w-0">
                <b className={`block truncate font-medium ${available ? '' : 'text-mute'}`}>{track.title}</b>
                <span className="block truncate text-sm text-mute">
                    {track.artist} · {formatDuration(track.duration)}
                </span>
            </span>
            {available ? (
                <button
                    type="button"
                    disabled={!canRequest || requesting}
                    title={canRequest ? undefined : '이미 신청한 곡이 있어요'}
                    onClick={() => onRequest(track)}
                    className="min-h-11 min-w-[4.5rem] rounded-[10px] bg-acc px-4 font-bold text-accink disabled:opacity-40"
                >
                    {requesting ? '신청 중…' : '신청'}
                </button>
            ) : (
                <span className="rounded-full border border-line px-3 py-1 text-xs text-mute">
                    {STATUS_LABEL[track.requestStatus as Exclude<RequestStatus, 'available'>]}
                </span>
            )}
        </li>
    )
}
