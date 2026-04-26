import './globals.css'
import { AuthProvider } from '@/lib/AuthContext'
import MouseGlow from '@/components/MouseGlow'

export const metadata = {
  title: 'Sportition - Sports Community Platform',
  description: 'Athletes prove their records, coaches design growth.',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // iOS 노치/홈인디케이터 영역까지 배경 연장 (env(safe-area-inset-*) 사용 가능)
  viewportFit: 'cover',
  themeColor: '#0c1024',  // body 배경과 일치 — 모바일 브라우저 status bar 자연스러움
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>
          <MouseGlow />
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
