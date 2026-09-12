import LegalPage from '@/components/LegalPage';

export const metadata = {
  title: 'Privacy Policy · DriveDash',
  description: 'How DriveDash handles your Google account data.',
};

const LAST_UPDATED = '13 September 2026';
const CONTACT = 'mathurshubham@gmail.com';
const GOOGLE_POLICY =
  'https://developers.google.com/terms/api-services-user-data-policy';
const REVOKE_URL = 'https://myaccount.google.com/permissions';

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated={LAST_UPDATED} kind="privacy">
      <section>
        <h2 className="text-base font-semibold text-fg">
          Who operates DriveDash
        </h2>
        <p className="mt-2">
          DriveDash is operated by Shubham Mathur, an individual developer. For privacy questions or
          deletion requests, contact{' '}
          <a
            href={`mailto:${CONTACT}`}
            className="underline underline-offset-2 hover:text-fg"
          >
            {CONTACT}
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-fg">
          Google data we access
        </h2>
        <p className="mt-2">When you sign in with Google, DriveDash requests access to:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Your Google Drive files — metadata and content — via the{' '}
            <code className="rounded surface-2 px-1 py-0.5 text-xs">
              drive
            </code>{' '}
            scope.
          </li>
          <li>
            App configuration stored in your hidden Drive appDataFolder via the{' '}
            <code className="rounded surface-2 px-1 py-0.5 text-xs">
              drive.appdata
            </code>{' '}
            scope.
          </li>
          <li>
            Your name and email address via{' '}
            <code className="rounded surface-2 px-1 py-0.5 text-xs">
              openid
            </code>
            ,{' '}
            <code className="rounded surface-2 px-1 py-0.5 text-xs">
              email
            </code>
            , and{' '}
            <code className="rounded surface-2 px-1 py-0.5 text-xs">
              profile
            </code>
            .
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-fg">
          How we use it
        </h2>
        <p className="mt-2">
          DriveDash uses this data only to search, open, download, share, and copy files in your own
          Google Drive when you explicitly ask it to. We do not read your files for any other
          purpose.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-fg">
          What is stored and where
        </h2>
        <p className="mt-2">
          DriveDash stores no Drive content and no Google tokens on its servers. Your session is
          kept in an encrypted cookie in your browser. Your pinned hot list and your share log
          (a record of the links and email shares you created from the app, including any
          optional message you typed) are JSON files in your own Google Drive appDataFolder — they
          stay in your account, not on our infrastructure.
        </p>
        <p className="mt-2">
          The only data held on our infrastructure is a registry of the Google accounts that have
          signed in: email address, display name, first and last sign-in time, and whether an
          administrator has disabled the account. It is stored in Cloudflare Workers KV, capped at
          a small number of accounts, and visible only to the app&apos;s administrator.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-fg">
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
        <h2 className="text-base font-semibold text-fg">
          Google API Services User Data Policy
        </h2>
        <p className="mt-2">
          DriveDash&apos;s use and transfer to any other app of information received from Google APIs
          will adhere to the Google API Services User Data Policy, including the Limited Use
          requirements. See the{' '}
          <a
            href={GOOGLE_POLICY}
            className="underline underline-offset-2 hover:text-fg"
            rel="noopener noreferrer"
            target="_blank"
          >
            Google API Services User Data Policy
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-fg">
          How to revoke access
        </h2>
        <p className="mt-2">
          You can remove DriveDash&apos;s access to your Google account at any time from{' '}
          <a
            href={REVOKE_URL}
            className="underline underline-offset-2 hover:text-fg"
            rel="noopener noreferrer"
            target="_blank"
          >
            Google Account permissions
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-fg">
          Retention
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Session cookies expire after 30 days.</li>
          <li>
            Your hot list and share log files in appDataFolder persist until you remove the
            app&apos;s data or delete those files yourself. Share log entries are kept as history
            (capped at 500) so you can see what was shared and when.
          </li>
          <li>
            Registry entries persist until an administrator removes them; removal frees the seat.
            To have yours removed, email the address above.
          </li>
        </ul>
      </section>
    </LegalPage>
  );
}
