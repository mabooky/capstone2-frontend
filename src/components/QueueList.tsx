import type { QueueEntry } from '../api/types.ts'
import { formatDuration } from '../lib/format.ts'

/** 좁은 화면(Compact, Medium)에서 보여줄 대기 곡 수입니다. 내가 신청한 곡은 순서와 상관없이 항상 보여줘요. */
const COMPACT_ROWS = 3

type Props = { queue: QueueEntry[] }

/** 재생 순서대로 정렬된 대기열입니다. */
export default function QueueList({ queue }: Props) {
    const hiddenOnSmall = queue.filter((entry, index) => index >= COMPACT_ROWS && !entry.mine).length

    return (
        <section aria-label="대기열" className="glass overflow-hidden rounded-[24px]">
            <h2 className="px-4 pt-4 text-sm text-mute">
                대기열 <span className="tabular-nums">{queue.length}</span>곡
            </h2>
            {queue.length === 0 ? (
                <p className="px-4 pt-3 pb-5 text-mute">대기열이 비어 있어요. 첫 곡을 신청해 보세요.</p>
            ) : (
                <ol className="mt-2">
                    {queue.map((entry, index) => {
                        const collapsible = index >= COMPACT_ROWS && !entry.mine
                        return (
                            <li
                                key={entry.queueId}
                                className={`grid-cols-[1.75rem_1fr_auto] items-center gap-3 border-t border-line px-4 py-3 ${
                                    collapsible ? 'hidden expanded:grid' : 'grid'
                                } ${entry.mine ? 'bg-acc/10' : ''}`}
                            >
                                <span className="text-center text-mute tabular-nums">{index + 1}</span>
                                <span className="min-w-0">
                                    <b className="block truncate font-medium">{entry.track.title}</b>
                                    <span className="block truncate text-sm text-mute">
                                        {entry.track.artist} · {formatDuration(entry.track.duration)}
                                    </span>
                                </span>
                                {entry.mine && (
                                    <span className="rounded-full bg-acc px-2.5 py-0.5 text-xs font-bold text-accink">
                                        내 곡
                                    </span>
                                )}
                            </li>
                        )
                    })}
                </ol>
            )}
            {hiddenOnSmall > 0 && (
                <p className="border-t border-line px-4 py-3 text-sm text-mute expanded:hidden">
                    외 {hiddenOnSmall}곡이 더 대기 중이에요.
                </p>
            )}
        </section>
    )
}
