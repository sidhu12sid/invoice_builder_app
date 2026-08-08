import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Invoice Generator',
  description: 'Fill in the form, preview live, and print your invoice.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
