import AppShell from '@/components/ui/AppShell';

/**
 * Server component so the signed-in segment keeps its static/RSC shape; the
 * providers live in the client `AppShell`.
 */
export default function AppLayout({ children }: LayoutProps<'/'>) {
  return <AppShell>{children}</AppShell>;
}
