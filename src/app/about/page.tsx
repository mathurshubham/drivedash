import Hero from '@/components/landing/Hero';
import HowItWorks from '@/components/landing/HowItWorks';
import Features from '@/components/landing/Features';
import PrivateByDesign from '@/components/landing/PrivateByDesign';
import LandingFooter from '@/components/landing/LandingFooter';

export const metadata = {
  title: 'DriveDash — your Drive, one thumb away',
  description:
    'A mobile-first front door to your own Google Drive: pin the files you use to shelves, search everything, and share links that expire on their own.',
};

/**
 * The public landing page, and the app home page URL registered on Google's
 * OAuth consent screen — hence the `/about` path, which must not move.
 *
 * A server component with exactly one client island (`Reveal`), so a stranger
 * arriving from the consent screen downloads almost no JavaScript.
 */
export default function AboutPage() {
  return (
    <main className="flex flex-1 flex-col overflow-x-hidden">
      <Hero />
      <HowItWorks />
      <Features />
      <PrivateByDesign />
      <LandingFooter />
    </main>
  );
}
