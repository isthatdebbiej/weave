import type { Metadata } from 'next';
import './globals.css';
import impact from '../../data/impact.json';

export const metadata: Metadata = { title: `${impact.manifest.displayName} Engineering Impact`, description: `Explore engineers, outcomes, and public evidence from ${impact.manifest.repository}.` };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
