import LegalPage from '@/components/LegalPage';
import Pressable, { Link } from '@/components/ui/Pressable';

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
        <Pressable as={Link} href="/login" variant="primary" size="lg">
          Sign in
        </Pressable>
      </p>
    </LegalPage>
  );
}
