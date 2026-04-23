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
