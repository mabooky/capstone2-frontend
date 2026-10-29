import { useEffect, useEffectEvent, useRef } from 'react'

type Props = {
    /** 이 요소가 화면 근처에 들어오면 호출돼요. */
    onVisible: () => void
    /** 목록이 바뀔 때마다 달라지는 값입니다. 바뀌면 다시 관찰해서, 아직 화면이 덜 찼을 때 이어서 불러와요. */
    version: number
}

/** 목록 맨 끝에 두는 보이지 않는 표시입니다. 스크롤이 여기에 가까워지면 다음 곡을 불러와요. */
export default function InfiniteSentinel({ onVisible, version }: Props) {
    const ref = useRef<HTMLDivElement>(null)
    const notify = useEffectEvent(onVisible)

    useEffect(() => {
        const element = ref.current
        if (!element) return
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) notify()
            },
            { rootMargin: '400px' },
        )
        observer.observe(element)
        return () => observer.disconnect()
    }, [version])

    return <div ref={ref} aria-hidden="true" className="h-px" />
}
