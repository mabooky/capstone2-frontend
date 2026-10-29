import { useState, type FormEvent } from 'react'
import { toApiError } from '../../api/client.ts'
import { messageFor } from '../../lib/errorMessage.ts'
import Alert from '../Alert.tsx'

type Props = {
    storeId: string
    /** 비밀번호가 틀리거나 서버에 닿지 못하면 거부돼요. */
    onLogin: (password: string) => Promise<void>
    /** 이전 세션이 끝난 이유 등, 로그인 전에 알려줄 말입니다. */
    notice?: string
}

/** 관리자 로그인 화면입니다. */
export default function LoginForm({ storeId, onLogin, notice }: Props) {
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string>()
    const [submitting, setSubmitting] = useState(false)

    const submit = async (event: FormEvent) => {
        event.preventDefault()
        if (password === '' || submitting) return
        setSubmitting(true)
        setError(undefined)
        try {
            await onLogin(password)
        } catch (caught) {
            setError(messageFor(toApiError(caught)))
            setSubmitting(false)
        }
    }

    return (
        <main className="flex min-h-svh items-center justify-center px-4 py-10">
            <form
                onSubmit={submit}
                className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-card p-7"
            >
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight">관리자 로그인</h1>
                    <p className="mt-1 text-sm text-mute">매장 {storeId}</p>
                </div>

                {notice && <Alert>{notice}</Alert>}

                <label className="block">
                    <span className="mb-1 block text-sm text-mute">비밀번호</span>
                    <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="current-password"
                        autoFocus
                        className="block w-full rounded-[10px] border border-line bg-bg px-3 py-3 text-ink"
                    />
                </label>

                {error && <Alert>{error}</Alert>}

                <button
                    type="submit"
                    disabled={password === '' || submitting}
                    className="min-h-12 w-full rounded-[10px] bg-acc font-bold text-accink disabled:opacity-40"
                >
                    {submitting ? '로그인하는 중이에요…' : '로그인'}
                </button>
            </form>
        </main>
    )
}
