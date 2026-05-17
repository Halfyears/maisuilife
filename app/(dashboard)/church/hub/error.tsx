'use client'

export default function ChurchHubError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h2 style={{ color: '#b91c1c' }}>教会中枢加载失败</h2>
      <pre style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 16, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {error?.message ?? '未知错误'}
        {error?.digest ? `\nDigest: ${error.digest}` : ''}
      </pre>
      <button
        onClick={reset}
        style={{ marginTop: 16, padding: '8px 20px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
      >
        重试
      </button>
    </div>
  )
}
