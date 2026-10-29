const CLIENT_ID_KEY = 'jukebox.clientId'
const adminTokenKey = (storeId: string) => `jukebox.adminToken.${storeId}`

/** HTTP(비보안) 주소에서는 crypto.randomUUID가 없을 수 있어 getRandomValues로 대신 만듭니다. */
function newUuid(): string {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

let memoryClientId: string | null = null

/** 이 브라우저의 고객 식별자입니다. 저장소를 쓸 수 없으면 새로고침 전까지만 유지됩니다. */
export function getClientId(): string {
    try {
        const saved = localStorage.getItem(CLIENT_ID_KEY)
        if (saved) return saved
        const created = newUuid()
        localStorage.setItem(CLIENT_ID_KEY, created)
        return created
    } catch {
        memoryClientId ??= newUuid()
        return memoryClientId
    }
}

const memoryAdminTokens = new Map<string, string>()

export function getAdminToken(storeId: string): string | null {
    try {
        return localStorage.getItem(adminTokenKey(storeId))
    } catch {
        return memoryAdminTokens.get(storeId) ?? null
    }
}

export function saveAdminToken(storeId: string, token: string): void {
    memoryAdminTokens.set(storeId, token)
    try {
        localStorage.setItem(adminTokenKey(storeId), token)
    } catch {
        // 저장소를 쓸 수 없으면 메모리에만 보관합니다.
    }
}

export function clearAdminToken(storeId: string): void {
    memoryAdminTokens.delete(storeId)
    try {
        localStorage.removeItem(adminTokenKey(storeId))
    } catch {
        // 저장소를 쓸 수 없으면 할 일이 없습니다.
    }
}
