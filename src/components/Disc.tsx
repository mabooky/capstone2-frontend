type Props = {
    /** LP판의 색상(0~359)입니다. */
    hue: number
    /** true이면 LP판이 돕니다. 동작 줄이기 설정이 켜져 있으면 돌지 않습니다. */
    spinning?: boolean
    className?: string
}

/** 가운데에 레몬색 라벨이 있는 LP판입니다. */
export default function Disc({ hue, spinning = false, className = 'size-60' }: Props) {
    const a = `hsl(${hue} 70% 55%)`
    const b = `hsl(${hue + 50} 80% 70%)`
    const c = `hsl(${hue} 70% 40%)`

    return (
        <div
            aria-hidden="true"
            className={`relative rounded-full motion-reduce:animate-none ${spinning ? 'animate-disc' : ''} ${className}`}
            style={{
                background: `repeating-radial-gradient(circle, rgba(0,0,0,.18) 0 1px, transparent 1px 4px), conic-gradient(from 0deg, ${a}, ${b}, ${c}, ${b}, ${a})`,
                boxShadow: '0 0 0 6px var(--card), 0 0 0 7px var(--line)',
            }}
        >
            <div className="absolute inset-[38%] rounded-full bg-lemon shadow-[0_0_0_5px_rgba(0,0,0,.15)]" />
            <div className="absolute top-1/2 left-1/2 size-2.5 -translate-1/2 rounded-full bg-bg" />
        </div>
    )
}
