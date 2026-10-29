/** 서버 주소입니다. 배포 서버를 기본값으로 쓰고, 로컬 서버를 쓸 때는 VITE_API_BASE로 바꿉니다. */
export const API_BASE: string =
    (import.meta.env.VITE_API_BASE as string | undefined) ?? 'https://capstone2-backend-production.up.railway.app'

export type Route = { storeId: string; view: 'customer' | 'admin' }

/** 첫 구간이 매장 ID로 쓸 수 없는 경로입니다. 빌드된 파일(assets)과 로그인 복귀 경로(auth)와 겹치지 않게 막아요. */
const RESERVED_FIRST_SEGMENTS = new Set(['assets', 'auth'])

/**
 * 주소의 경로에서 매장 ID와 화면을 읽습니다. 기본값은 없으며, 해석할 수 없으면 null입니다.
 * /{매장}은 고객 화면(매장 QR 코드), /{매장}/admin은 관리자 화면이고 끝의 슬래시는 있어도 없어도 같아요.
 */
export function parseRoute(pathname: string): Route | null {
    const segments = pathname.split('/').filter(Boolean)
    const [storeId, second] = segments
    if (storeId === undefined || !/^[A-Za-z0-9_-]+$/.test(storeId)) return null
    if (RESERVED_FIRST_SEGMENTS.has(storeId.toLowerCase())) return null
    if (segments.length === 1) return { storeId, view: 'customer' }
    if (segments.length === 2 && second.toLowerCase() === 'admin') return { storeId, view: 'admin' }
    return null
}

/** 처음 접속한 주소의 경로입니다. 화면 전환은 링크 이동(새로고침)으로 하므로 한 번만 읽어요. */
export const ROUTE: Route | null = parseRoute(location.pathname)
