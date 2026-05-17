export const dynamic = 'force-dynamic'
export const metadata = { title: '教会管理中枢 — 麦穗喜乐' }

export default function ChurchHubPage() {
  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>church/hub 诊断页</h1>
      <p>如果你能看到这行字，说明页面已正常渲染，问题出在之前的 layout 或代码里。</p>
      <p style={{ color: '#888', fontSize: 12 }}>commit: diagnostic-v1</p>
    </div>
  )
}
