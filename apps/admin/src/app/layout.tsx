import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Print Bro Super Admin Control Center',
  description: 'Enterprise Cloud Fleet & Print Management Control Center',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#0a0f1d] text-slate-100 antialiased selection:bg-blue-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
