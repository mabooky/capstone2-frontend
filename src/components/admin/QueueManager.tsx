import { useEffect, useState } from 'react'
import type { QueueEntry } from '../../api/types.ts'
import { formatDuration } from '../../lib/format.ts'

type Props = {
    queue: QueueEntry[]
    onRemove: (entry: QueueEntry) => void
}

/** 관리자용 대기열입니다. 곡을 빼려면 삭제 버튼을 두 번 눌러야 해요. */
export default function QueueManager({ queue, onRemove }: Props) {
    const [armedId, setArmedId] = useState<string>()

    useEffect(() => {
        if (!armedId) return
        const timer = setTimeout(() => setArmedId(undefined), 3000)
        return () => clearTimeout(timer)
    }, [armedId])

    const press = (entry: QueueEntry) => {
        if (armedId !== entry.queueId) {
            setArmedId(entry.queueId)
            return
        }
        setArmedId(undefined)
        onRemove(entry)
    }

    return (
        <section aria-label="대기열 관리" className="glass overflow-hidden rounded-[24px]">
            <h2 className="px-4 pt-4 text-sm text-mute">
                대기열 <span className="tabular-nums">{queue.length}</span>곡
            </h2>
            {queue.length === 0 ? (
                <p className="px-4 pt-3 pb-5 text-mute">대기열이 비어 있어요.</p>
            ) : (
                <ol className="mt-2">
                    {queue.map((entry, index) => (
                        <li
                            key={entry.queueId}
                            className="grid grid-cols-[1.75rem_1fr_auto] items-center gap-3 border-t border-line px-4 py-3"
                        >
                            <span className="text-center text-mute tabular-nums">{index + 1}</span>
                            <span className="min-w-0">
                                <b className="block truncate font-medium">{entry.track.title}</b>
                                <span className="block truncate text-sm text-mute">
                                    {entry.track.artist} · {formatDuration(entry.track.duration)}
                                </span>
                            </span>
                            <button
                                type="button"
                                onClick={() => press(entry)}
                                aria-label={`${entry.track.title} 삭제`}
                                className={`btn px-3 text-sm ${armedId === entry.queueId ? 'btn-danger' : 'btn-glass'}`}
                            >
                                {armedId === entry.queueId ? '정말 삭제?' : '삭제'}
                            </button>
                        </li>
                    ))}
                </ol>
            )}
            <p className="border-t border-line px-4 py-3 text-xs text-mute">
                재생되지 않고 빠진 곡에는 쿨타임이 없어서, 신청한 사람이 바로 다시 신청할 수 있어요.
            </p>
        </section>
    )
}
