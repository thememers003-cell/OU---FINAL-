import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'XPOS — Print On Screen',
  description: 'Self-service printing kiosk. Upload, pay, and print from anywhere. Fast, simple, and secure.',
  keywords: ['printing', 'kiosk', 'self-service', 'XPOS', 'print on screen'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#020617" />
      </head>
      <body className="min-h-screen grid-pattern">
        <main className="min-h-screen max-w-lg mx-auto relative">
          {children}
        </main>
      </body>
    </html>
  );
}
