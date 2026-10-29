/** 매장 QR 코드를 거치지 않았거나 등록되지 않은 매장일 때 보여주는 화면입니다. */
export default function InvalidAccess() {
    return (
        <main className="flex min-h-svh items-center justify-center p-6">
            <div className="glass-strong flex max-w-sm flex-col items-center gap-3 rounded-[28px] px-8 py-10 text-center">
                <h1 className="text-3xl font-extrabold tracking-tight">잘못된 접근이에요</h1>
                <p className="text-mute">매장에 있는 QR 코드를 다시 스캔해 주세요.</p>
            </div>
        </main>
    )
}
