import { createApi } from './api/client.ts'
import InvalidAccess from './components/InvalidAccess.tsx'
import { API_BASE, ROUTE } from './config.ts'
import AdminPage from './pages/AdminPage.tsx'
import CustomerPage from './pages/CustomerPage.tsx'
import SpotifyCallbackPage from './pages/SpotifyCallbackPage.tsx'
import { isSpotifyCallbackPath } from './spotify/config.ts'

const api = ROUTE === null ? null : createApi(API_BASE, ROUTE.storeId)

/**
 * 고객 화면은 /{매장}, 관리자 화면은 /{매장}/admin입니다. 고객 화면은 매장 QR 코드로만 들어오므로 기본 매장은 없어요.
 * Spotify 로그인을 마치고 돌아오는 경로(/auth/spotify/callback)만 매장 없이 열려요.
 */
export default function App() {
    if (isSpotifyCallbackPath(location.pathname)) return <SpotifyCallbackPage />
    if (ROUTE === null || api === null) return <InvalidAccess />

    return (
        <div className="min-h-svh">
            {ROUTE.view === 'admin' ? (
                <AdminPage api={api} storeId={ROUTE.storeId} />
            ) : (
                <CustomerPage api={api} storeId={ROUTE.storeId} />
            )}
        </div>
    )
}
