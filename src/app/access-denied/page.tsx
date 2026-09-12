import AccessDeniedClient from './AccessDeniedClient';

interface AccessDeniedPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AccessDeniedPage({ searchParams }: AccessDeniedPageProps) {
  const params = await searchParams;
  const raw = params.reason;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const initialReason = value === 'full' || value === 'blocked' ? value : null;

  return <AccessDeniedClient initialReason={initialReason} />;
}
