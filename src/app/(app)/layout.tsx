import AppShell from '@/components/ui/AppShell';
import { auth } from '@/lib/auth';

/**
 * Server component so the signed-in segment keeps its static/RSC shape; the
 * providers live in the client `AppShell`. `isAdmin` is resolved here (from
 * the session) so the client shell never has to guess before its first
 * paint — `BottomNav`'s Users tab depends on it.
 */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const session = await auth();
  const isAdmin = session?.isAdmin === true;
  return <AppShell isAdmin={isAdmin}>{children}</AppShell>;
}
