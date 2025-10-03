import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy – VendAI',
}

export default function PrivacyPage() {
  return (
    <main className="module-background min-h-screen text-slate-100">
      <section className="max-w-3xl mx-auto px-6 py-16 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">Privacy Policy</h1>
          <p className="text-slate-400 text-sm">Last updated: {new Date().toLocaleDateString()}</p>
        </header>

        <p>
          VendAI is committed to protecting your privacy. This Privacy Policy explains how we collect,
          use, disclose, and safeguard information when you access the VendAI Services.
        </p>

        <div className="space-y-6 text-sm leading-relaxed text-slate-300">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Information We Collect</h2>
            <div className="space-y-3">
              <div>
                <h3 className="font-medium text-slate-200 mb-1">Personal Information:</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Name, email address, phone number, and organization details</li>
                  <li>Authentication credentials and profile information</li>
                  <li>Payment and billing information for subscriptions</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-slate-200 mb-1">Business Data:</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Product catalogs, inventory records, and pricing information</li>
                  <li>Customer data, supplier information, and transaction records</li>
                  <li>Sales reports, analytics, and operational metrics</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-slate-200 mb-1">Technical Information:</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Device type, operating system, browser version, and IP address</li>
                  <li>Usage patterns, feature interactions, and performance metrics</li>
                  <li>Error logs, crash reports, and diagnostic information</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. How We Use Your Information</h2>
            <div className="space-y-2">
              <p className="font-medium text-slate-200">Service Delivery:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Provide and maintain the VendAI platform and all its features</li>
                <li>Process transactions and maintain accurate business records</li>
                <li>Enable secure authentication and account management</li>
                <li>Facilitate communication between team members and organizations</li>
              </ul>
              
              <p className="font-medium text-slate-200 mt-3">Improvement and Analytics:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Analyze usage patterns to improve features and user experience</li>
                <li>Develop new functionality based on customer needs</li>
                <li>Monitor system performance and identify technical issues</li>
              </ul>
              
              <p className="font-medium text-slate-200 mt-3">Communication and Support:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Send service updates, security alerts, and product announcements</li>
                <li>Provide technical support and customer service</li>
                <li>Deliver educational content and best practices</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Information Sharing and Disclosure</h2>
            <p className="mb-3">We do not sell, rent, or trade your personal information. We may share information in these limited circumstances:</p>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Service Providers:</strong> Trusted third parties who help us operate the platform (hosting, payment processing, analytics) under strict confidentiality agreements.</li>
              <li><strong>Legal Requirements:</strong> When required by law, regulation, legal process, or government request.</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets, with appropriate data protection commitments.</li>
              <li><strong>Safety and Security:</strong> To protect the rights, property, or safety of VendAI, our users, or the public.</li>
              <li><strong>With Consent:</strong> Any other sharing will only occur with your explicit consent.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Data Security and Retention</h2>
            <div className="space-y-2">
              <p className="mb-2">We implement industry-standard security measures to protect your information:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>End-to-end encryption for data transmission and storage</li>
                <li>Regular security audits and vulnerability assessments</li>
                <li>Access controls and authentication requirements for our staff</li>
                <li>Automated backup systems and disaster recovery procedures</li>
              </ul>
              <p className="mt-3">We retain your information as long as your account is active or as needed to provide services, comply with legal obligations, resolve disputes, and enforce our agreements.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Your Privacy Rights</h2>
            <p className="mb-2">Depending on your location, you may have the following rights regarding your personal information:</p>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Access:</strong> Request a copy of the personal information we hold about you.</li>
              <li><strong>Correction:</strong> Update or correct inaccurate or incomplete information.</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information, subject to certain exceptions.</li>
              <li><strong>Portability:</strong> Receive your data in a structured, machine-readable format.</li>
              <li><strong>Restriction:</strong> Limit how we process your information in certain circumstances.</li>
              <li><strong>Objection:</strong> Object to processing based on legitimate interests.</li>
              <li><strong>Withdraw Consent:</strong> Withdraw previously given consent for data processing.</li>
            </ul>
            <p className="mt-2">To exercise these rights, contact us at privacy@vendai.digital. We will respond within the timeframes required by applicable law.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. International Data Transfers</h2>
            <p>
              VendAI operates globally and may transfer your information to countries other than where you reside.
              We ensure appropriate safeguards are in place, including standard contractual clauses and adequacy decisions,
              to protect your information during international transfers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Children&apos;s Privacy</h2>
            <p>
              VendAI is not intended for use by individuals under 16 years of age. We do not knowingly collect
              personal information from children under 16. If you believe we have collected such information,
              please contact us immediately so we can delete it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Updates to This Policy</h2>
            <p>
              We may update this Privacy Policy periodically to reflect changes in our practices or applicable laws.
              We will notify you of material changes via email or through the application. Your continued use of the
              Services after such notification constitutes acceptance of the updated policy.
            </p>
          </section>
        </div>

        <footer className="text-sm text-slate-500">
          For privacy inquiries, contact <a href="mailto:privacy@vendai.digital" className="underline">privacy@vendai.digital</a>.
        </footer>
      </section>
    </main>
  )
}
