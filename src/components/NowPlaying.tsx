import type { CSSProperties } from 'react'
import type { NowPlayingEntry } from '../api/types.ts'
import { useNow } from '../hooks/useNow.ts'
import { formatDuration } from '../lib/format.ts'
import { hueFor } from '../lib/hue.ts'
import Disc from './Disc.tsx'

type Props = {
    nowPlaying: NowPlayingEntry | null
    /** nowPlaying을 받은 응답의 serverTime입니다. */
    serverTime: number
    /** 그 응답을 받은 내 기기의 시각입니다. 서버와 시계가 달라도 경과 시간을 맞추는 데 씁니다. */
    receivedAt: number
}

/** 지금 재생 중인 곡입니다. 좁은 화면에서는 가로로, 넓은 화면에서는 LP판을 크게 세로로 배치해요. */
export default function NowPlaying({ nowPlaying, serverTime, receivedAt }: Props) {
    const now = useNow()

    if (!nowPlaying) {
        return (
            <section
                aria-label="재생 중"
                className="glass flex items-center gap-4 rounded-[24px] p-4 expanded:flex-col expanded:gap-5 expanded:p-6"
            >
                <Disc hue={235} className="size-24 shrink-0 medium:size-32 expanded:size-56 xlarge:size-64" />
                <p className="text-mute">아직 재생 중인 곡이 없어요.</p>
            </section>
        )
    }

    const { track, startedAt } = nowPlaying
    // 응답을 받은 뒤 지난 시간만큼 더해서, 폴링 사이에도 진행 바가 부드럽게 움직이게 해요.
    const elapsed = Math.min(Math.max(serverTime - startedAt + (now - receivedAt), 0), track.duration)
    const percent = track.duration > 0 ? (elapsed / track.duration) * 100 : 0

    // 곡의 LP 색을 옅게 유리 틴트에 입혀서, 곡이 바뀌면 카드의 분위기도 함께 바뀌어요. (세기는 대비가 유지되도록 CSS가 정해요.)
    const hue = hueFor(track.spotifyId)
    const hueStyle = { '--glass-hue': hue } as CSSProperties

    return (
        <section
            aria-label="재생 중"
            style={hueStyle}
            className="glass glass-hue flex items-center gap-4 rounded-[24px] p-4 expanded:flex-col expanded:gap-5 expanded:p-6"
        >
            <Disc
                hue={hue}
                spinning
                className="size-24 shrink-0 medium:size-32 expanded:size-56 xlarge:size-64"
            />
            <div className="min-w-0 flex-1 expanded:w-full expanded:flex-none expanded:text-center">
                <p className="text-xs text-mute">지금 재생 중</p>
                <b className="block truncate text-lg expanded:text-xl">{track.title}</b>
                <span className="block truncate text-mute">{track.artist}</span>
                <div className="mt-3 h-1.5 overflow-hidden rounded-[3px] bg-line" aria-hidden="true">
                    <i className="block h-full bg-acc" style={{ width: `${percent}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-xs text-mute tabular-nums">
                    <span>{formatDuration(elapsed)}</span>
                    <span>{formatDuration(track.duration)}</span>
                </div>
            </div>
        </section>
    )
}
