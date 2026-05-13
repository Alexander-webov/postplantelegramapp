import { ImageResponse } from 'next/og';

// Route segment config — Next.js auto-generates favicon from this
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

// Renders a 32x32 PNG matching the Logo mark (rounded square with primary color
// and a checkmark + dot/bar pattern). Served at /icon and used as <link rel="icon">.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#7c3aed',
          borderRadius: 8,
          color: 'white',
          fontSize: 22,
          fontWeight: 700,
          fontFamily: 'sans-serif',
          letterSpacing: -1,
        }}
      >
        П
      </div>
    ),
    { ...size },
  );
}
