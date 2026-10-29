import type { ToastMessage } from '../hooks/useToast.ts'

/** 화면 아래에 잠깐 뜨는 안내입니다. 화면 낭독기는 내용이 바뀔 때마다 읽어줘요. */
export default function Toast({ toast }: { toast: ToastMessage | undefined }) {
    return (
        <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 bottom-6 z-10 flex justify-center px-4"
        >
            {toast && (
                <p
                    key={toast.id}
                    className={`max-w-md rounded-[10px] border px-4 py-3 text-sm shadow-lg ${
                        toast.tone === 'error' ? 'border-err bg-card text-err' : 'border-line bg-card text-ink'
                    }`}
                >
                    {toast.text}
                </p>
            )}
        </div>
    )
}
