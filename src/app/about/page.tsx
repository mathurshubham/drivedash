import Link from 'next/link';
import LegalPage from '@/components/LegalPage';

export const metadata = {
  title: 'About · DriveDash',
  description: 'What DriveDash is and who it is for.',
};

const LAST_UPDATED = '12 September 2026';

export default function AboutPage() {
  return (
    <LegalPage title="About DriveDash" lastUpdated={LAST_UPDATED} kind="about">
      <p>
        DriveDash is a mobile-first web app that wraps your own Google Drive. You can search your
        files, pin favourites to a hot list, open and download documents, share links, and copy files
        for clients — all from one fast interface tuned for phones.
      </p>
      <p>
        It is built for individuals who manage their own Drive and want quicker access to the files
        they share most often. DriveDash only acts on your explicit instructions; it does not browse
        or change anything in your Drive without you asking.
      </p>
      <p>
        <Link
          href="/login"
          className="inline-flex min-h-[52px] items-center justify-center rounded-xl bg-accent-600 px-5 text-base font-medium text-white transition-colors hover:bg-accent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:focus-visible:outline-accent-400"
        >
          Sign in
        </Link>
      </p>
    </LegalPage>
  );
}
