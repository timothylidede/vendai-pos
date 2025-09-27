import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms & Conditions – VendAI',
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="max-w-3xl mx-auto px-6 py-16 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">Terms &amp; Conditions</h1>
          <p className="text-slate-400 text-sm">Last updated: {new Date().toLocaleDateString()}</p>
        </header>

        <p>
          These Terms &amp; Conditions (the “Terms”) govern your use of the VendAI platform,
          including the web application, desktop application, mobile interfaces, APIs, and
          any related services (collectively, the “Services”). By accessing or using the Services,
          you agree to comply with these Terms.
        </p>

        <div className="space-y-6 text-sm leading-relaxed text-slate-300">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Account Responsibilities</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Provide accurate registration information and maintain current contact details.</li>
              <li>Keep your login credentials secure and do not share them with unauthorized individuals.</li>
              <li>Notify VendAI immediately of any suspected unauthorized access or security breaches.</li>
              <li>You are solely responsible for all activity conducted through your account.</li>
              <li>Maintain appropriate user permissions and access controls within your organization.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Acceptable Use Policy</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Use the Services exclusively for legitimate business purposes in compliance with all applicable laws.</li>
              <li>Do not attempt to reverse-engineer, decompile, or extract source code from the platform.</li>
              <li>Respect API rate limits and do not attempt to overload or disrupt our infrastructure.</li>
              <li>Do not use the Services to store, transmit, or process illegal, harmful, or offensive content.</li>
              <li>Do not resell, redistribute, or provide access to the Services to unauthorized third parties.</li>
              <li>Report any security vulnerabilities or system abuse to our security team immediately.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Subscription and Payment Terms</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Subscription fees are billed in advance and are non-refundable except as required by law.</li>
              <li>You may cancel your subscription at any time, with service continuing until the end of your billing period.</li>
              <li>We reserve the right to modify pricing with 30 days advance notice to active subscribers.</li>
              <li>Late payments may result in service suspension after appropriate notice.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Data Ownership and Security</h2>
            <p className="mb-2">
              You retain all rights to your business data. VendAI processes personal data in accordance with our Privacy Policy.
              You are responsible for:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Obtaining necessary consents from end users whose data you process through our Services.</li>
              <li>Complying with applicable data protection laws (GDPR, CCPA, etc.).</li>
              <li>Maintaining regular backups of critical business data.</li>
              <li>Configuring appropriate data retention and deletion policies.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Service Availability and Support</h2>
            <p className="mb-2">
              While we strive for maximum uptime, VendAI does not guarantee uninterrupted service availability.
              We provide:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Regular system maintenance windows with advance notification.</li>
              <li>Technical support through designated channels during business hours.</li>
              <li>Best-effort data recovery assistance in case of system failures.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, VendAI's total liability for any claims arising from your use
              of the Services shall not exceed the amount paid by you for the Services in the 12 months preceding
              the claim. We are not liable for indirect, incidental, or consequential damages.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Termination</h2>
            <p className="mb-2">
              Either party may terminate this agreement with appropriate notice. Upon termination:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Your access to the Services will be suspended or terminated.</li>
              <li>You may export your data within 30 days of termination.</li>
              <li>VendAI may delete your data after the retention period expires.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Changes to Terms</h2>
            <p>
              We may update these Terms periodically. Material changes will be communicated via email or
              in-app notifications at least 30 days in advance. Continued use of the Services constitutes
              acceptance of the updated Terms.
            </p>
          </section>
        </div>

        <footer className="text-sm text-slate-500">
          For questions about these Terms, please contact <a href="mailto:legal@vendai.digital" className="underline">legal@vendai.digital</a>.
        </footer>
      </section>
    </main>
  )
}
