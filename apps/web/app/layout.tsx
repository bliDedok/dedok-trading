import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Dedok Trading Assistant', description: 'Transparent, risk-first crypto trading assistant' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
