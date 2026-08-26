import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'XPOS Kiosk — Print On Screen',
  description: 'XPOS Self-Service Printing Kiosk',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className="min-h-screen overflow-hidden">{children}</body>
    </html>
  );
}
