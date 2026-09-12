import LegalPage from '@/components/LegalPage';

export const metadata = {
  title: 'Privacy Policy · DriveDash',
  description: 'How DriveDash handles your Google account data.',
};

const LAST_UPDATED = '12 September 2026';
const CONTACT = 'mathurshubham@gmail.com';
const GOOGLE_POLICY =
  'https://developers.google.com/terms/api-services-user-data-policy';
const REVOKE_URL = 'https://myaccount.google.com/permissions';

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated={LAST_UPDATED} kind="privacy">
      <section>
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          Who operates DriveDash
        </h2>
        <p className="mt-2">
          DriveDash is operated by Shubham Mathur, an individual developer. For privacy questions or
          deletion requests, contact{' '}
          <a
            href={`mailto:${CONTACT}`}
            className="underline underline-offset-2 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            {CONTACT}
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          Google data we access
        </h2>
        <p className="mt-2">When you sign in with Google, DriveDash requests access to:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Your Google Drive files — metadata and content — via the{' '}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">
              drive
            </code>{' '}
            scope.
          </li>
          <li>
            App configuration stored in your hidden Drive appDataFolder via the{' '}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">
              drive.appdata
            </code>{' '}
            scope.
          </li>
          <li>
            Your name and email address via{' '}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">
              openid
            </code>
            ,{' '}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">
              email
            </code>
            , and{' '}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">
              profile
            </code>
            .
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          How we use it
        </h2>
        <p className="mt-2">
          DriveDash uses this data only to search, open, download, share, and copy files in your own
          Google Drive when you explicitly ask it to. We do not read your files for any other
          purpose.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          What is stored and where
        </h2>
        <p className="mt-2">
          DriveDash stores almost nothing on its servers. Your session is kept in an encrypted
          cookie in your browser. Your pinned hot list and share log are JSON files in your own
          Google Drive appDataFolder — they stay in your account, not on our infrastructure.
        </p>
        <p className="mt-2">
          The allowlist of approved email addresses and any pending access requests are stored in
          Cloudflare KV so admins can manage who may sign in. These entries hold email addresses and
          optional admin notes only; they do not contain your Drive file contents.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          What we do not do
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>We do not sell your data.</li>
          <li>We do not use your data for advertising.</li>
          <li>We do not share your data with third parties.</li>
          <li>We do not use your data to train AI models.</li>
          <li>
            We do not access your Drive except when you take an action while signed in as yourself.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          Google API Services User Data Policy
        </h2>
        <p className="mt-2">
          DriveDash&apos;s use and transfer to any other app of information received from Google APIs
          will adhere to the Google API Services User Data Policy, including the Limited Use
          requirements. See the{' '}
          <a
            href={GOOGLE_POLICY}
            className="underline underline-offset-2 hover:text-neutral-900 dark:hover:text-neutral-100"
            rel="noopener noreferrer"
            target="_blank"
          >
            Google API Services User Data Policy
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          How to revoke access
        </h2>
        <p className="mt-2">
          You can remove DriveDash&apos;s access to your Google account at any time from{' '}
          <a
            href={REVOKE_URL}
            className="underline underline-offset-2 hover:text-neutral-900 dark:hover:text-neutral-100"
            rel="noopener noreferrer"
            target="_blank"
          >
            Google Account permissions
          </a>
          . To request deletion of any KV-held allowlist or access-request records associated with
          your email, contact{' '}
          <a
            href={`mailto:${CONTACT}`}
            className="underline underline-offset-2 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            {CONTACT}
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          Retention
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Session cookies expire after 30 days.</li>
          <li>
            Hot list and share log files in your appDataFolder persist until you remove the
            app&apos;s data or delete those files yourself.
          </li>
          <li>KV allowlist and access-request entries remain until an admin removes them.</li>
        </ul>
      </section>
    </LegalPage>
  );
}
