import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size    = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width:          '100%',
          height:         '100%',
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          background:     'linear-gradient(145deg, #F59E0B 0%, #D97706 60%, #B45309 100%)',
        }}
      >
        {/* Wheat SVG — scaled for 180px */}
        <svg width="72" height="72" viewBox="0 0 220 220" style={{ marginBottom: '4px' }}>
          <line x1="110" y1="200" x2="110" y2="40" stroke="#FEF3C7" strokeWidth="7" strokeLinecap="round" />
          <ellipse cx="110" cy="44" rx="14" ry="22" fill="#FEF3C7" opacity="0.95" />
          <ellipse cx="87"  cy="72"  rx="13" ry="20" fill="#FEF3C7" opacity="0.92" transform="rotate(-28 87 72)"  />
          <ellipse cx="78"  cy="104" rx="13" ry="20" fill="#FEF3C7" opacity="0.90" transform="rotate(-32 78 104)" />
          <ellipse cx="76"  cy="136" rx="13" ry="19" fill="#FEF3C7" opacity="0.85" transform="rotate(-35 76 136)" />
          <ellipse cx="133" cy="72"  rx="13" ry="20" fill="#FEF3C7" opacity="0.92" transform="rotate(28 133 72)"  />
          <ellipse cx="142" cy="104" rx="13" ry="20" fill="#FEF3C7" opacity="0.90" transform="rotate(32 142 104)" />
          <ellipse cx="144" cy="136" rx="13" ry="19" fill="#FEF3C7" opacity="0.85" transform="rotate(35 144 136)" />
          <line x1="110" y1="72"  x2="87"  y2="72"  stroke="#FEF3C7" strokeWidth="4" opacity="0.7" />
          <line x1="110" y1="72"  x2="133" y2="72"  stroke="#FEF3C7" strokeWidth="4" opacity="0.7" />
          <line x1="110" y1="104" x2="78"  y2="104" stroke="#FEF3C7" strokeWidth="4" opacity="0.7" />
          <line x1="110" y1="104" x2="142" y2="104" stroke="#FEF3C7" strokeWidth="4" opacity="0.7" />
          <line x1="110" y1="136" x2="76"  y2="136" stroke="#FEF3C7" strokeWidth="4" opacity="0.7" />
          <line x1="110" y1="136" x2="144" y2="136" stroke="#FEF3C7" strokeWidth="4" opacity="0.7" />
        </svg>

        {/* 麦穗 text */}
        <div
          style={{
            color:         '#FEF3C7',
            fontSize:      '48px',
            fontWeight:    '900',
            letterSpacing: '0.03em',
            lineHeight:    '1',
          }}
        >
          麦穗
        </div>
      </div>
    ),
    { ...size }
  )
}
