import { useEffect, useState } from 'react'
import Alert from '../components/Alert.tsx'
import { completeSpotifyLogin, SpotifyAuthError } from '../spotify/auth.ts'

type Failure = { message: string; storeId?: string }

/** Spotify 로그인을 마치고 돌아오는 화면입니다. 토큰을 저장한 뒤 로그인하러 나갔던 관리자 화면으로 돌려보내요. */
export default function SpotifyCallbackPage() {
    const [failure, setFailure] = useState<Failure>()

    useEffect(() => {
        let cancelled = false
        completeSpotifyLogin(new URLSearchParams(location.search))
            .then((storeId) => {
                // 뒤로 가기로 이 화면에 다시 오지 않도록 기록을 바꿔치기해요.
                location.replace(`/${encodeURIComponent(storeId)}/admin`)
            })
            .catch((caught: unknown) => {
                if (cancelled) return
                setFailure(
                    caught instanceof SpotifyAuthError
                        ? { message: caught.message, storeId: caught.storeId }
                        : { message: 'Spotify 연결을 마치지 못했어요.' },
                )
            })
        return () => {
            cancelled = true
        }
    }, [])

    return (
        <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
            {failure ? (
                <>
                    <h1 className="text-3xl font-extrabold tracking-tight">Spotify에 연결하지 못했어요</h1>
                    <div className="max-w-md">
                        <Alert>{failure.message}</Alert>
                    </div>
                    {failure.storeId && (
                        <a
                            href={`/${encodeURIComponent(failure.storeId)}/admin`}
                            className="btn btn-primary"
                        >
                            관리자 화면으로 돌아가기
                        </a>
                    )}
                </>
            ) : (
                <p className="text-mute">Spotify 연결을 마무리하는 중이에요…</p>
            )}
        </main>
    )
}
