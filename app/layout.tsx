import './globals.css';
import '@/styles/auth/del-auth.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AppShell } from '@/components/AppShell';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/components/AuthProvider';
import { ConversationProvider } from '@/components/ConversationProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DEL — AI Executive Intelligence Platform',
  description: 'DELCA VisionTech AI-powered executive persona-matching and event-intelligence platform',
  icons: {
    icon: '/favicon.png',
    apple: '/ChatGPT_Image_Aug_4,_2026,_08_30_15_AM.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <ConversationProvider>
              <AppShell>{children}</AppShell>
            </ConversationProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
