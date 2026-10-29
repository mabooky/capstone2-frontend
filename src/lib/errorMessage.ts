import type { ApiError } from '../api/client.ts'

/** 서버의 오류를 화면에 보여줄 해요체 문구로 바꿉니다. 서버 메시지는 표현이 바뀔 수 있어 code로 정합니다. */
export function messageFor(error: ApiError): string {
    switch (error.code) {
        case 'OUT_OF_MOOD':
            return '지금 분위기와 맞지 않는 곡이에요. 목록을 새로 불러왔어요.'
        case 'TRACK_ALREADY_QUEUED':
            return '이미 대기 중이거나 재생 중인 곡이에요.'
        case 'TRACK_COOLDOWN': {
            const minutes = Math.max(1, Math.ceil((error.retryAfterSec ?? 60) / 60))
            return `최근에 재생된 곡이에요. 약 ${minutes}분 뒤에 다시 신청할 수 있어요.`
        }
        case 'MY_REQUEST_PENDING':
            return '이미 신청한 곡이 있어요. 내 곡이 재생되면 다시 신청할 수 있어요.'
        case 'TRACK_NOT_FOUND':
            return '등록되지 않은 곡이에요.'
        case 'INVALID_CREDENTIALS':
            return '비밀번호가 맞지 않아요.'
        case 'UNAUTHORIZED':
            return '로그인이 필요해요. 다시 로그인해 주세요.'
        case 'INVALID_INPUT':
            return '입력한 값이 올바르지 않아요. 다시 확인해 주세요.'
        case 'NO_TRACKS':
            return '기준점 안에 재생할 수 있는 곡이 없어요. 기준점을 바꿔 보세요.'
        case 'NOT_NEXT_IN_QUEUE':
            return '대기열이 바뀌었어요. 다시 시도해 주세요.'
        case 'QUEUE_ITEM_NOT_FOUND':
            return '이미 대기열에서 빠진 곡이에요.'
        case 'NETWORK_ERROR':
            return '서버에 연결하지 못했어요. 잠시 뒤에 다시 시도해 주세요.'
        default:
            return '요청을 처리하지 못했어요. 잠시 뒤에 다시 시도해 주세요.'
    }
}
