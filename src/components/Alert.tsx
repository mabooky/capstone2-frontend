import type { ReactNode } from 'react'

/** 오류 안내입니다. 화면 낭독기가 바로 읽어 주도록 role="alert"를 씁니다. */
export default function Alert({ children }: { children: ReactNode }) {
    return (
        <p role="alert" className="rounded-[14px] border border-err/50 bg-err/10 p-3.5 text-sm text-err">
            {children}
        </p>
    )
}
