import { useEffect, useEffectEvent, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { toApiError, type Api, type ApiError } from '../../api/client.ts'
import type { Mood, Track } from '../../api/types.ts'
import { useDebouncedValue } from '../../hooks/useDebouncedValue.ts'

type Draft = { valence: number; arousal: number; n: number }

type Props = {
    api: Api
    token: string
    /** 미리보기 중에 401이 오면 호출돼요. 로그인 화면으로 돌아갔으면 true를 돌려줘요. */
    onUnauthorized: (error: ApiError) => boolean
    /** 서버에 적용된 지금 기준점입니다. */
    mood: Mood | undefined
    /** 지금 기준점에서 가까운 곡들입니다. (카탈로그) */
    catalog: Track[]
    /** 기준점을 적용합니다. 성공하면 true를 돌려줘요. */
    onApply: (draft: Draft) => Promise<boolean>
}

const SIZE = 400
const PAD = 24
const HALF = SIZE / 2 - PAD
const toX = (valence: number) => SIZE / 2 + valence * HALF
const toY = (arousal: number) => SIZE / 2 - arousal * HALF
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const round2 = (value: number) => Math.round(value * 100) / 100
const GRID = [-1, -0.5, 0, 0.5, 1]

/** 감정 좌표 평면에서 기준점과 곡 수(n)를 고르는 영역입니다. 고르는 동안 가까운 곡을 미리 보여줘요. */
export default function MoodPicker({ api, token, onUnauthorized, mood, catalog, onApply }: Props) {
    const [draft, setDraft] = useState<Draft | null>(null)
    const [preview, setPreview] = useState<{ key: string; tracks: Track[] }>()
    const [hoveredId, setHoveredId] = useState<string>()
    const [previewFailed, setPreviewFailed] = useState(false)
    const [applying, setApplying] = useState(false)

    const current: Draft = { valence: mood?.valence ?? 0, arousal: mood?.arousal ?? 0, n: mood?.n ?? 100 }
    const value = draft ?? current
    const dirty =
        draft !== null &&
        (draft.valence !== current.valence || draft.arousal !== current.arousal || draft.n !== current.n)

    const edit = (patch: Partial<Draft>) => setDraft({ ...value, ...patch })

    // 점을 옮기는 동안에는 잠깐 기다렸다가 한 번만 미리보기를 불러와요. 새 요청을 보내면 이전 요청은 취소해요.
    const previewKey = draft ? `${draft.valence}|${draft.arousal}|${draft.n}` : ''
    const debouncedKey = useDebouncedValue(previewKey, 200)
    const handleUnauthorized = useEffectEvent(onUnauthorized)

    useEffect(() => {
        if (!debouncedKey) return
        const [valence, arousal, n] = debouncedKey.split('|').map(Number)
        const controller = new AbortController()
        api.previewMood(token, { valence, arousal, n }, controller.signal)
            .then((tracks) => {
                if (controller.signal.aborted) return
                setPreview({ key: debouncedKey, tracks })
                setPreviewFailed(false)
            })
            .catch((caught: unknown) => {
                if (controller.signal.aborted) return
                if (!handleUnauthorized(toApiError(caught))) setPreviewFailed(true)
            })
        return () => controller.abort()
    }, [api, token, debouncedKey])

    const pointFrom = (event: PointerEvent<SVGSVGElement>) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const x = ((event.clientX - rect.left) / rect.width) * SIZE
        const y = ((event.clientY - rect.top) / rect.height) * SIZE
        return {
            valence: round2(clamp((x - SIZE / 2) / HALF, -1, 1)),
            arousal: round2(clamp((SIZE / 2 - y) / HALF, -1, 1)),
        }
    }

    const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        edit(pointFrom(event))
    }

    const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
        if (event.buttons === 1) edit(pointFrom(event))
    }

    const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
        const step = event.shiftKey ? 0.25 : 0.05
        switch (event.key) {
            case 'ArrowLeft':
                edit({ valence: round2(clamp(value.valence - step, -1, 1)) })
                break
            case 'ArrowRight':
                edit({ valence: round2(clamp(value.valence + step, -1, 1)) })
                break
            case 'ArrowUp':
                edit({ arousal: round2(clamp(value.arousal + step, -1, 1)) })
                break
            case 'ArrowDown':
                edit({ arousal: round2(clamp(value.arousal - step, -1, 1)) })
                break
            default:
                return
        }
        event.preventDefault()
    }

    const apply = async () => {
        if (!draft || applying) return
        setApplying(true)
        const applied = await onApply(draft)
        setApplying(false)
        if (applied) {
            setDraft(null)
            setPreview(undefined)
        }
    }

    const shownPreview = draft ? preview?.tracks : undefined
    // 고른 점이 바뀐 뒤 새 미리보기가 도착하기 전까지는 이전 결과를 흐리게 보여줘요.
    const stale = draft !== null && preview?.key !== previewKey
    // 고르는 중이면 미리보기를, 아니면 지금 신청할 수 있는 곡(카탈로그)을 목록으로 보여줘요.
    const listTracks = draft ? preview?.tracks : mood ? catalog : undefined
    const hovered = listTracks?.find((track) => track.spotifyId === hoveredId)

    return (
        <section aria-label="기준점 선택" className="space-y-4 rounded-[14px] border border-line bg-card p-4">
            <div>
                <h2 className="text-sm text-mute">기준점</h2>
                <p className="mt-1 text-sm">
                    평면을 눌러서 기준점을 골라 보세요. 점에서 가까운 곡들이 고객이 신청할 수 있는 곡이 돼요. 이미
                    대기열에 있는 곡은 기준점을 바꿔도 그대로 남아요.
                </p>
            </div>

            <div className="grid gap-4 large:grid-cols-[minmax(0,480px)_1fr] large:items-start large:gap-6">
                <div className="space-y-4">
                    <svg
                        viewBox={`0 0 ${SIZE} ${SIZE}`}
                        role="application"
                        aria-label="기준점 선택 평면입니다. 방향키로 점을 옮길 수 있어요."
                        tabIndex={0}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onKeyDown={onKeyDown}
                        className="mx-auto aspect-square w-full max-w-[520px] cursor-crosshair touch-none rounded-[10px] border border-line bg-bg select-none"
                    >
                        {GRID.map((g) => (
                            <g key={g}>
                                <line
                                    x1={toX(g)}
                                    y1={PAD}
                                    x2={toX(g)}
                                    y2={SIZE - PAD}
                                    className={g === 0 ? 'stroke-mute/50' : 'stroke-line'}
                                    strokeWidth={g === 0 ? 1.5 : 1}
                                />
                                <line
                                    x1={PAD}
                                    y1={toY(g)}
                                    x2={SIZE - PAD}
                                    y2={toY(g)}
                                    className={g === 0 ? 'stroke-mute/50' : 'stroke-line'}
                                    strokeWidth={g === 0 ? 1.5 : 1}
                                />
                            </g>
                        ))}

                        {catalog.map((track) => (
                            <circle
                                key={track.spotifyId}
                                cx={toX(track.valence)}
                                cy={toY(track.arousal)}
                                r={3}
                                className="fill-mute/50"
                            >
                                <title>
                                    {track.title} · {track.artist}
                                </title>
                            </circle>
                        ))}
                        {shownPreview?.map((track) => (
                            <circle
                                key={track.spotifyId}
                                cx={toX(track.valence)}
                                cy={toY(track.arousal)}
                                r={4.5}
                                className="fill-acc"
                            >
                                <title>
                                    {track.title} · {track.artist}
                                </title>
                            </circle>
                        ))}

                        {hovered && (
                            <circle
                                cx={toX(hovered.valence)}
                                cy={toY(hovered.arousal)}
                                r={8}
                                className="pointer-events-none fill-lemon stroke-ink"
                                strokeWidth={2}
                            />
                        )}

                        {mood && (
                            <circle
                                cx={toX(mood.valence)}
                                cy={toY(mood.arousal)}
                                r={9}
                                className="fill-none stroke-mute"
                                strokeWidth={2}
                            />
                        )}
                        <circle
                            cx={toX(value.valence)}
                            cy={toY(value.arousal)}
                            r={9}
                            className="fill-lemon stroke-acc"
                            strokeWidth={3}
                        />

                        <text x={PAD + 2} y={SIZE / 2 - 6} fontSize={14} className="fill-mute">
                            부정
                        </text>
                        <text x={SIZE - PAD - 2} y={SIZE / 2 - 6} fontSize={14} textAnchor="end" className="fill-mute">
                            긍정
                        </text>
                        <text x={SIZE / 2 + 8} y={PAD - 8} fontSize={14} className="fill-mute">
                            활기
                        </text>
                        <text x={SIZE / 2 + 8} y={SIZE - 8} fontSize={14} className="fill-mute">
                            차분
                        </text>
                    </svg>

                    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute">
                        <li className="flex items-center gap-1.5">
                            <span className="size-2.5 rounded-full bg-mute/50" /> 지금 신청할 수 있는 곡
                        </li>
                        <li className="flex items-center gap-1.5">
                            <span className="size-2.5 rounded-full bg-acc" /> 미리보기
                        </li>
                        <li className="flex items-center gap-1.5">
                            <span className="size-2.5 rounded-full border-2 border-mute" /> 지금 기준점
                        </li>
                    </ul>
                </div>

                <div className="space-y-4">
                    <div className="space-y-3">
                        <label className="block">
                            <span className="flex justify-between text-sm">
                                <span>부정 ↔ 긍정</span>
                                <span className="text-mute tabular-nums">{value.valence.toFixed(2)}</span>
                            </span>
                            <input
                                type="range"
                                min={-1}
                                max={1}
                                step={0.01}
                                value={value.valence}
                                onChange={(event) => edit({ valence: round2(Number(event.target.value)) })}
                                className="w-full accent-acc"
                            />
                        </label>
                        <label className="block">
                            <span className="flex justify-between text-sm">
                                <span>차분 ↔ 활기</span>
                                <span className="text-mute tabular-nums">{value.arousal.toFixed(2)}</span>
                            </span>
                            <input
                                type="range"
                                min={-1}
                                max={1}
                                step={0.01}
                                value={value.arousal}
                                onChange={(event) => edit({ arousal: round2(Number(event.target.value)) })}
                                className="w-full accent-acc"
                            />
                        </label>
                        <label className="block">
                            <span className="flex justify-between text-sm">
                                <span>신청할 수 있는 곡 수</span>
                                <span className="text-mute tabular-nums">{value.n}곡</span>
                            </span>
                            <input
                                type="range"
                                min={1}
                                max={100}
                                step={1}
                                value={value.n}
                                onChange={(event) => edit({ n: Number(event.target.value) })}
                                className="w-full accent-acc"
                            />
                        </label>
                    </div>

                    {previewFailed && <p className="text-sm text-err">미리보기를 불러오지 못했어요.</p>}

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={apply}
                            disabled={!dirty || applying}
                            className="min-h-11 rounded-[10px] bg-acc px-5 font-bold text-accink disabled:opacity-40"
                        >
                            {applying ? '적용하는 중이에요…' : '기준점 적용'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setDraft(null)
                                setPreview(undefined)
                            }}
                            disabled={draft === null || applying}
                            className="min-h-11 rounded-[10px] border border-line bg-card px-5 font-bold disabled:opacity-40"
                        >
                            되돌리기
                        </button>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-sm text-mute">
                            {draft ? '이 기준점에서 가까운 곡' : '지금 신청할 수 있는 곡'}
                            {listTracks && (
                                <>
                                    {' '}
                                    · <span className="tabular-nums">{listTracks.length}</span>곡
                                </>
                            )}
                        </h3>
                        {stale && <p className="text-xs text-mute">미리보기를 불러오는 중이에요…</p>}
                        {listTracks === undefined ? (
                            <p className="text-sm text-mute">불러오는 중이에요…</p>
                        ) : listTracks.length === 0 ? (
                            <p className="text-sm text-mute">신청할 수 있는 곡이 없어요.</p>
                        ) : (
                            <ol
                                className={`max-h-80 overflow-y-auto rounded-[10px] border border-line ${
                                    stale ? 'opacity-60' : ''
                                }`}
                            >
                                {listTracks.map((track, index) => (
                                    <li
                                        key={track.spotifyId}
                                        tabIndex={0}
                                        onMouseEnter={() => setHoveredId(track.spotifyId)}
                                        onMouseLeave={() => setHoveredId(undefined)}
                                        onFocus={() => setHoveredId(track.spotifyId)}
                                        onBlur={() => setHoveredId(undefined)}
                                        className={`grid grid-cols-[1.75rem_1fr_auto] items-center gap-3 border-b border-line px-3 py-2 last:border-b-0 ${
                                            hoveredId === track.spotifyId ? 'bg-acc/10' : ''
                                        }`}
                                    >
                                        <span className="text-center text-xs text-mute tabular-nums">{index + 1}</span>
                                        <span className="min-w-0">
                                            <b className="block truncate text-sm font-medium">{track.title}</b>
                                            <span className="block truncate text-xs text-mute">{track.artist}</span>
                                        </span>
                                        <span className="text-xs text-mute tabular-nums">
                                            {track.valence.toFixed(2)}, {track.arousal.toFixed(2)}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                </div>
            </div>
        </section>
    )
}
