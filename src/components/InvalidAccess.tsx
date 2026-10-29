/** 매장 QR 코드를 거치지 않았거나 등록되지 않은 매장일 때 보여주는 화면입니다. */
export default function InvalidAccess() {
    return (
        <main className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
            <h1 className="text-3xl font-extrabold tracking-tight">잘못된 접근이에요</h1>
            <p className="text-mute">매장에 있는 QR 코드를 다시 스캔해 주세요.</p>
        </main>
    )
}
