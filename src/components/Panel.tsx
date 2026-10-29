import type { ReactNode } from 'react'

type Props = { title?: string; children: ReactNode }

/** 카드 모양의 영역입니다. */
export default function Panel({ title, children }: Props) {
    return (
        <section className="glass rounded-[24px] p-4 medium:p-5">
            {title && <h2 className="mb-1 text-sm text-mute">{title}</h2>}
            {children}
        </section>
    )
}
