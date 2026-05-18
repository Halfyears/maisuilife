import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size    = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width:        '100%',
          height:       '100%',
          display:      'flex',
          flexDirection: 'column',
          alignItems:   'center',
          justifyContent: 'center',
          background:   'linear-gradient(145deg, #F59E0B 0%, #D97706 60%, #B45309 100%)',
          borderRadius: '96px',
        }}
      >
        {/* Wheat SVG */}
        <svg
          width="220"
          height="220"
          viewBox="0 0 220 220"
          style={{ marginBottom: '8px' }}
        >
          {/* Central stem */}
          <line x1="110" y1="200" x2="110" y2="40" stroke="#FEF3C7" strokeWidth="7" strokeLinecap="round" />

          {/* Top grain head */}
          <ellipse cx="110" cy="44" rx="14" ry="22" fill="#FEF3C7" opacity="0.95" />

          {/* Left grains */}
          <ellipse cx="87"  cy="72"  rx="13" ry="20" fill="#FEF3C7" opacity="0.92" transform="rotate(-28 87 72)"  />
          <ellipse cx="78"  cy="104" rx="13" ry="20" fill="#FEF3C7" opacity="0.90" transform="rotate(-32 78 104)" />
          <ellipse cx="76"  cy="136" rx="13" ry="19" fill="#FEF3C7" opacity="0.85" transform="rotate(-35 76 136)" />
          <ellipse cx="80"  cy="166" rx="12" ry="18" fill="#FEF3C7" opacity="0.80" transform="rotate(-30 80 166)" />

          {/* Right grains */}
          <ellipse cx="133" cy="72"  rx="13" ry="20" fill="#FEF3C7" opacity="0.92" transform="rotate(28 133 72)"  />
          <ellipse cx="142" cy="104" rx="13" ry="20" fill="#FEF3C7" opacity="0.90" transform="rotate(32 142 104)" />
          <ellipse cx="144" cy="136" rx="13" ry="19" fill="#FEF3C7" opacity="0.85" transform="rotate(35 144 136)" />
          <ellipse cx="140" cy="166" rx="12" ry="18" fill="#FEF3C7" opacity="0.80" transform="rotate(30 140 166)" />

          {/* Stem connections to grains */}
          <line x1="110" y1="72"  x2="87"  y2="72"  stroke="#FEF3C7" strokeWidth="4" opacity="0.7" />
          <line x1="110" y1="72"  x2="133" y2="72"  stroke="#FEF3C7" strokeWidth="4" opacity="0.7" />
          <line x1="110" y1="104" x2="78"  y2="104" stroke="#FEF3C7" strokeWidth="4" opacity="0.7" />
          <line x1="110" y1="104" x2="142" y2="104" stroke="#FEF3C7" strokeWidth="4" opacity="0.7" />
          <line x1="110" y1="136" x2="76"  y2="136" stroke="#FEF3C7" strokeWidth="4" opacity="0.7" />
          <line x1="110" y1="136" x2="144" y2="136" stroke="#FEF3C7" strokeWidth="4" opacity="0.7" />
          <line x1="110" y1="166" x2="80"  y2="166" stroke="#FEF3C7" strokeWidth="3" opacity="0.6" />
          <line x1="110" y1="166" x2="140" y2="166" stroke="#FEF3C7" strokeWidth="3" opacity="0.6" />
        </svg>

        {/* 麦穗 text */}
        <div
          style={{
            color:        '#FEF3C7',
            fontSize:     '88px',
            fontWeight:   '900',
            letterSpacing: '0.05em',
            lineHeight:   '1',
            textShadow:   '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          麦穗
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
