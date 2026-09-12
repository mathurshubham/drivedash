import LegalPage from '@/components/LegalPage';

export const metadata = {
  title: 'Terms of Service · DriveDash',
  description: 'Terms for using DriveDash.',
};

const LAST_UPDATED = '12 September 2026';
const CONTACT = 'mathurshubham@gmail.com';

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated={LAST_UPDATED} kind="terms">
      <p>
        DriveDash is a personal tool provided by Shubham Mathur for managing your own Google Drive
        files. It is offered for individual, internal use. By signing in, you agree to these terms.
      </p>

      <section>
        <h2 className="text-base font-semibold text-fg">
          Your responsibility
        </h2>
        <p className="mt-2">
          You are responsible for what you share from your Drive. DriveDash helps you create links
          and permissions, but you decide who receives access. Do not share sensitive material with
          people who should not see it.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-fg">
          No warranty
        </h2>
        <p className="mt-2">
          DriveDash is provided &ldquo;as is&rdquo; without warranty of any kind. It may be
          unavailable, contain bugs, or change without notice. Use it at your own risk.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-fg">
          Governing law
        </h2>
        <p className="mt-2">
          These terms are governed by the laws of India. The operator is based in India.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-fg">Contact</h2>
        <p className="mt-2">
          Questions about these terms:{' '}
          <a
            href={`mailto:${CONTACT}`}
            className="underline underline-offset-2 hover:text-fg"
          >
            {CONTACT}
          </a>
          .
        </p>
      </section>
    </LegalPage>
  );
}
