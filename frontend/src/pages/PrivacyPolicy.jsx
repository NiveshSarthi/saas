import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Privacy Policy</CardTitle>
            <p className="text-sm text-slate-500">Last updated: December 17, 2025</p>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-3">1. Information We Collect</h2>
              <p className="text-slate-700 mb-2">
                We collect information that you provide directly to us, including:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-slate-700">
                <li>Name and contact information (email, phone number)</li>
                <li>Account credentials</li>
                <li>Profile information</li>
                <li>Communications with us</li>
                <li>Lead information submitted through forms</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">2. How We Use Your Information</h2>
              <p className="text-slate-700 mb-2">
                We use the information we collect to:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-slate-700">
                <li>Provide, maintain, and improve our services</li>
                <li>Process and complete transactions</li>
                <li>Send you technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Communicate with you about products, services, and events</li>
                <li>Monitor and analyze trends and usage</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">3. Information Sharing</h2>
              <p className="text-slate-700">
                We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-slate-700 mt-2">
                <li>With your consent</li>
                <li>To comply with legal obligations</li>
                <li>To protect our rights and property</li>
                <li>With service providers who assist in our operations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">4. Data Security</h2>
              <p className="text-slate-700">
                We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">5. Facebook Lead Ads Integration</h2>
              <p className="text-slate-700">
                When you submit a lead form through Facebook or Instagram ads, we collect the information you provide. This data is processed according to both our privacy policy and Facebook's data policies.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">6. Cookies and Tracking</h2>
              <p className="text-slate-700">
                We use cookies and similar tracking technologies to track activity on our service and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">7. Your Rights</h2>
              <p className="text-slate-700 mb-2">
                You have the right to:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-slate-700">
                <li>Access your personal information</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Object to processing of your data</li>
                <li>Request data portability</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">8. Data Retention</h2>
              <p className="text-slate-700">
                We retain your personal information for as long as necessary to fulfill the purposes outlined in this privacy policy, unless a longer retention period is required by law.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">9. Children's Privacy</h2>
              <p className="text-slate-700">
                Our service is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">10. Changes to This Policy</h2>
              <p className="text-slate-700">
                We may update this privacy policy from time to time. We will notify you of any changes by posting the new privacy policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">11. Contact Us</h2>
              <p className="text-slate-700">
                If you have any questions about this privacy policy, please contact us at:
              </p>
              <p className="text-slate-700 mt-2">
                <strong>Email:</strong> info@niveshsarthi.com<br />
                <strong>Address:</strong> Nivesh Sarthi, India
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}