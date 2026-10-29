import { useState } from 'react'
import type { Api, ApiError } from '../api/client.ts'
import { clearAdminToken, getAdminToken, saveAdminToken } from '../lib/identity.ts'

/** 관리자 로그인 상태입니다. 토큰은 매장별로 브라우저에 저장해 두었다가 다시 열면 이어서 써요. */
export function useAdminSession(api: Api, storeId: string) {
    const [token, setToken] = useState<string | null>(() => getAdminToken(storeId))
    /** 로그인 화면에 보여줄 안내입니다. (예: 다른 곳에서 로그인해서 로그아웃됨) */
    const [notice, setNotice] = useState<string>()

    const login = async (password: string) => {
        const result = await api.login(password)
        saveAdminToken(storeId, result.token)
        setNotice(undefined)
        setToken(result.token)
    }

    const logout = (message?: string) => {
        clearAdminToken(storeId)
        setNotice(message)
        setToken(null)
    }

    /** 관리자 API가 401을 돌려주면 로그인 화면으로 돌아가고 true를 돌려줍니다. 다른 오류는 false예요. */
    const handleUnauthorized = (error: ApiError): boolean => {
        if (error.code !== 'UNAUTHORIZED') return false
        logout('다른 곳에서 로그인했거나 로그인이 만료됐어요. 다시 로그인해 주세요.')
        return true
    }

    return { token, notice, login, logout, handleUnauthorized }
}
