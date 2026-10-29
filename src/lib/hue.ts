/** 곡마다 LP판 색상이 달라지도록, 문자열(spotifyId 등)에서 0~359 사이의 색상 값을 정합니다. */
export function hueFor(key: string): number {
    let sum = 0
    for (let i = 0; i < key.length; i++) sum = (sum * 31 + key.charCodeAt(i)) % 360
    return (sum * 47 + 235) % 360
}
