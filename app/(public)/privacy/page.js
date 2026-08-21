import LegalPage from '../legal/LegalPage.js';

export const metadata = {
  title: 'Privacy Policy — YoungFreedom',
  description: 'What information YoungFreedom collects when you apply, why, and how it is protected.'
};

const TOC = [
  { id: 'overview', label: 'Overview' },
  { id: 'what-we-collect', label: 'What we collect' },
  { id: 'why', label: 'Why we collect it' },
  { id: 'sharing', label: 'Who we share it with' },
  { id: 'storage', label: 'Where it is stored' },
  { id: 'phone-numbers', label: 'Phone number handling' },
  { id: 'retention', label: 'How long we keep it' },
  { id: 'rights', label: 'Your choices' },
  { id: 'cookies', label: 'Cookies' },
  { id: 'security', label: 'Security' }
];

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Legal" title="Privacy Policy" updated="20 August 2026" toc={TOC} active="privacy">

      <section id="overview">
        <h2>1. Overview</h2>
        <p>
          This page explains what personal information YoungFreedom collects
          when you apply for a job through our website, why we collect it,
          and how it is protected. We collect only what is needed to verify
          your application and match you with employers — nothing more.
        </p>
      </section>

      <section id="what-we-collect">
        <h2>2. What we collect</h2>
        <p>When you fill in the application form, we collect:</p>
        <ul>
          <li><b>Name and phone number</b> — required, used to identify your application and for our team to contact you;</li>
          <li><b>District, qualification, trade, and experience</b> — required, used to match you against open roles;</li>
          <li><b>Email address</b> — optional;</li>
          <li><b>Resume file</b> — optional, uploaded directly to our storage provider (Cloudinary) rather than passing through our own servers;</li>
          <li><b>Payment confirmation</b> — the fee amount and a payment reference from our payment processor. We never see or store your card number, UPI PIN, or net banking credentials — these are handled entirely by the payment processor, which is built for that purpose and never shares them with us.</li>
        </ul>
      </section>

      <section id="why">
        <h2>3. Why we collect it</h2>
        <ul>
          <li>To verify your qualification and documents;</li>
          <li>To match your profile against current employer openings;</li>
          <li>To let our calling team contact you about your application's progress;</li>
          <li>To let you check your own application status later, using the link or your phone number.</li>
        </ul>
      </section>

      <section id="sharing">
        <h2>4. Who we share it with</h2>
        <p>We share your details only with:</p>
        <ul>
          <li><b>Employer partners</b> you are being matched with, once your profile is verified;</li>
          <li><b>Our payment processor</b>, to process the processing fee — they receive only what is needed to complete the payment;</li>
          <li><b>Cloudinary</b>, our file storage provider, to host your resume if you upload one.</li>
        </ul>
        <p>We do not sell your information to anyone, for any reason.</p>
      </section>

      <section id="storage">
        <h2>5. Where it is stored</h2>
        <p>
          Application data is stored in a MongoDB Atlas database. An
          application that has not been paid for is held separately and is
          <b> automatically and permanently deleted after 24 hours</b> if
          the fee is not completed — it never becomes a permanent record
          until payment is confirmed.
        </p>
      </section>

      <section id="phone-numbers">
        <h2>6. Phone number handling</h2>
        <p>
          Inside our admin dashboard, phone numbers are masked by default
          (shown as, for example, <span style={{fontFamily:'var(--f-mono)'}}>98•••••210</span>) and only
          revealed one at a time by an authorised team member, with every
          reveal logged and limited to a daily cap. This exists specifically
          to protect your number from being copied or misused by anyone with
          dashboard access.
        </p>
      </section>

      <section id="retention">
        <h2>7. How long we keep it</h2>
        <p>
          A paid application is kept for as long as needed to support your
          placement and to meet our own record-keeping obligations. You can
          ask us to delete your data at any time by writing to the email
          below, and we will remove it unless we are legally required to
          keep a record of the transaction.
        </p>
      </section>

      <section id="rights">
        <h2>8. Your choices</h2>
        <ul>
          <li>You can check your application's status at any time using your saved link, or by entering your phone number on the website;</li>
          <li>You can ask us what data we hold about you;</li>
          <li>You can ask us to correct or delete your data, subject to the retention note above.</li>
        </ul>
      </section>

      <section id="cookies">
        <h2>9. Cookies</h2>
        <p>
          The candidate-facing website does not use tracking or advertising
          cookies. Our admin dashboard, used only by our own staff, sets a
          single secure, httpOnly session cookie to keep a logged-in team
          member signed in — this is never set on the public application
          pages.
        </p>
      </section>

      <section id="security">
        <h2>10. Security</h2>
        <p>
          Payments are processed over an encrypted connection by our payment
          processor, and confirmed only through a cryptographically signed
          notification, so a payment cannot be faked or intercepted.
          Passwords for our own staff accounts are never stored in plain
          text, and every staff account requires two-factor authentication
          in addition to a password.
        </p>
      </section>

    </LegalPage>
  );
}
