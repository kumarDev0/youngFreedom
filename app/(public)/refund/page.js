import LegalPage from '../legal/LegalPage.js';

export const metadata = {
  title: 'Refund & Cancellation Policy — YoungFreedom',
  description: 'When a processing fee is refunded, when it is not, and how to request one.'
};

const TOC = [
  { id: 'before-you-pay', label: 'Before you pay' },
  { id: 'eligible', label: 'When a refund is given' },
  { id: 'not-eligible', label: 'When a refund is not given' },
  { id: 'how-to-request', label: 'How to request one' },
  { id: 'timeline', label: 'Processing timeline' },
  { id: 'cancellation', label: 'Cancelling an application' }
];

export default function RefundPage() {
  return (
    <LegalPage eyebrow="Legal" title="Refund & Cancellation Policy" updated="20 August 2026" toc={TOC} active="refund">

      <section id="before-you-pay">
        <h2>1. Before you pay</h2>
        <p>
          The amount you are asked to pay — ₹149 or ₹249, decided
          automatically by the qualification you select — is a <b>one-time
          processing and verification fee</b>, not a placement fee. It pays
          for document verification and profile matching. It is <b>not a
          guarantee of an interview, a job offer, or placement</b> with any
          employer. Please read this in full before paying.
        </p>
      </section>

      <section id="eligible">
        <h2>2. When a refund is given</h2>
        <p>We refund the processing fee in full when:</p>
        <ul>
          <li><b>You were charged more than once</b> for the same application, due to a technical or payment error;</li>
          <li><b>Your payment was deducted from your bank or UPI app, but your application was never confirmed</b> on our end within 48 hours, and our own reconciliation cannot locate the payment against your application;</li>
          <li><b>We reject your application due to an error on our side</b> — for example, a document verification mistake that was our fault, not a mismatch in what you submitted.</li>
        </ul>
      </section>

      <section id="not-eligible">
        <h2>3. When a refund is not given</h2>
        <div className="lg-callout warn">
          <p>The processing fee is not refunded when:</p>
        </div>
        <ul>
          <li>Your application is verified correctly, but <b>no employer makes you an offer</b> — this was disclosed upfront as not guaranteed;</li>
          <li>Your application is rejected because the <b>documents or details you provided did not match or were inaccurate</b>;</li>
          <li>You simply <b>change your mind</b> after your application has already been verified and shared with an employer;</li>
          <li>You request a refund <b>more than 15 days</b> after payment, for reasons other than the eligible cases above.</li>
        </ul>
      </section>

      <section id="how-to-request">
        <h2>4. How to request a refund</h2>
        <p>
          Write to us at the email below with your <b>application reference
          number</b> (shown on your status page, in the format
          <span style={{fontFamily:'var(--f-mono)'}}> YF-2026-000000</span>), the phone number you
          applied with, and the reason for the request. We will confirm
          receipt within 2 working days.
        </p>
      </section>

      <section id="timeline">
        <h2>5. Processing timeline</h2>
        <p>
          Once a refund is approved, it is processed within <b>7–10 working
          days</b> and credited back to the original payment method (the
          same card, UPI ID, or bank account the payment was made from) —
          this is a rule set by our payment processor and Indian banking
          systems, not something either of us can speed up from our end.
        </p>
      </section>

      <section id="cancellation">
        <h2>6. Cancelling an application before you pay</h2>
        <p>
          If you fill in the application form but do not complete the
          payment, nothing is charged and no permanent record is created.
          An unpaid application is automatically and permanently deleted
          from our systems after 24 hours — there is nothing further you
          need to do to "cancel" it.
        </p>
      </section>

    </LegalPage>
  );
}
