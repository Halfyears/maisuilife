'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="zh-CN">
      <body style={{ padding: 40, fontFamily: 'sans-serif', backgroundColor: '#fff' }}>
        <h2 style={{ color: '#b91c1c' }}>⚠️ 根布局错误</h2>
        <p style={{ fontSize: 14, color: '#374151' }}>错误信息：<strong>{error?.message ?? '无消息'}</strong></p>
        {error?.digest && (
          <p style={{ fontSize: 12, color: '#6b7280' }}>Digest: {error.digest}</p>
        )}
        <pre style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
          padding: 16, fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          maxHeight: 400, overflow: 'auto',
        }}>
          {error?.stack ?? '无堆栈'}
        </pre>
        <button
          onClick={reset}
          style={{ marginTop: 16, padding: '8px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          重试
        </button>
      </body>
    </html>
  )
}
