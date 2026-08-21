import LegalPage from '../legal/LegalPage.js';

export const metadata = {
  title: 'Terms & Conditions — YoungFreedom',
  description: 'The terms that govern using YoungFreedom to apply for verified industrial job openings across India.'
};

const TOC = [
  { id: 'who-we-are', label: 'Who we are' },
  { id: 'what-the-service-is', label: 'What the service is' },
  { id: 'the-fee', label: 'The processing fee' },
  { id: 'no-guarantee', label: 'No placement guarantee' },
  { id: 'eligibility', label: 'Eligibility & accuracy' },
  { id: 'conduct', label: 'Acceptable use' },
  { id: 'ip', label: 'Intellectual property' },
  { id: 'liability', label: 'Limitation of liability' },
  { id: 'changes', label: 'Changes to these terms' },
  { id: 'law', label: 'Governing law' }
];

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Legal" title="Terms & Conditions" updated="20 August 2026" toc={TOC} active="terms">

      <section id="who-we-are">
        <h2>1. Who we are</h2>
        <p>
          YoungFreedom ("YoungFreedom", "we", "us") operates the website and
          services at youngfreedom.onrender.com, connecting skilled candidates
          from Bihar with verified industrial and manufacturing employers
          across India. By using this website, submitting an application, or
          paying the processing fee described below, you agree to these
          Terms &amp; Conditions.
        </p>
      </section>

      <section id="what-the-service-is">
        <h2>2. What the service is</h2>
        <p>
          YoungFreedom is a <b>recruitment facilitation and document
          verification service</b>. We collect a candidate's details,
          qualification documents, and resume; verify them; and share
          verified profiles with our network of employer partners in
          manufacturing and industrial sectors. We do not employ candidates
          ourselves, and we are not a party to any employment contract formed
          between a candidate and an employer.
        </p>
      </section>

      <section id="the-fee">
        <h2>3. The processing fee</h2>
        <p>
          Submitting an application requires a one-time, non-recurring
          processing and verification fee, shown in Indian Rupees before
          payment and calculated automatically from the qualification you
          select:
        </p>
        <table className="lg-table">
          <thead><tr><th>Qualification</th><th>Fee</th></tr></thead>
          <tbody>
            <tr><td>10th, 12th, ITI / Trade</td><td>₹149</td></tr>
            <tr><td>Diploma, B.Tech, Graduation</td><td>₹249</td></tr>
          </tbody>
        </table>
        <p>
          This fee covers the cost of verifying your documents, matching your
          profile against current openings, and maintaining your profile in
          our system. It is charged and collected through our payment
          processing partner; we do not store your card, UPI, or banking
          details ourselves.
        </p>
      </section>

      <section id="no-guarantee">
        <h2>4. No placement guarantee</h2>
        <div className="lg-callout warn">
          <p>
            Paying the processing fee confirms that your application has been
            received and will be verified — it is <b>not a guarantee of a
            job offer, an interview, or placement with any employer</b>.
            Outcomes depend on document verification, employer requirements,
            and openings available at the time.
          </p>
        </div>
      </section>

      <section id="eligibility">
        <h2>5. Eligibility &amp; accuracy of information</h2>
        <ul>
          <li>You must be at least 18 years old to apply.</li>
          <li>The name, phone number, qualification, and other details you submit must be accurate. We verify documents against what you provide, and a mismatch can delay or end your application.</li>
          <li>Uploading a resume or document that is not genuinely yours, or that misrepresents your qualifications, is grounds for immediate rejection without refund.</li>
        </ul>
      </section>

      <section id="conduct">
        <h2>6. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Submit false, misleading, or someone else's information or documents;</li>
          <li>Attempt to interfere with, probe, or disrupt the website or its underlying systems;</li>
          <li>Use the website for any purpose other than applying to genuine job openings listed by us.</li>
        </ul>
      </section>

      <section id="ip">
        <h2>7. Intellectual property</h2>
        <p>
          The YoungFreedom name, logo, website design, and content are owned
          by us and may not be copied or reused without written permission.
          Documents and resumes you upload remain yours; you grant us a
          limited licence to use them solely to verify your application and
          share your profile with prospective employers.
        </p>
      </section>

      <section id="liability">
        <h2>8. Limitation of liability</h2>
        <p>
          YoungFreedom facilitates introductions between candidates and
          employers; the working conditions, salary, and conduct of any
          employer are outside our control. To the maximum extent permitted
          by law, YoungFreedom is not liable for any dispute, loss, or damage
          arising from your employment or interaction with an employer
          introduced through this service.
        </p>
      </section>

      <section id="changes">
        <h2>9. Changes to these terms</h2>
        <p>
          We may update these terms from time to time. The "Last updated"
          date at the top of this page will always reflect the current
          version. Continuing to use the website after a change means you
          accept the updated terms.
        </p>
      </section>

      <section id="law">
        <h2>10. Governing law</h2>
        <p>
          These terms are governed by the laws of India, and any dispute is
          subject to the exclusive jurisdiction of the courts at Patna,
          Bihar.
        </p>
      </section>

    </LegalPage>
  );
}
