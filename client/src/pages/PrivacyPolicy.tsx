export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">
          Effective Date: May 6, 2025 &nbsp;|&nbsp; Last Updated: May 6, 2025
        </p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
          <p className="text-muted-foreground leading-relaxed">
            GMK Web Solutions ("we," "us," or "our") operates The Signal, an AI-powered social
            media scheduling and automation platform ("Service"). This Privacy Policy explains how
            we collect, use, disclose, and protect information when you use The Signal at{" "}
            <a
              href="https://thesignal.gmkwebsolutions.com"
              className="underline hover:text-primary"
            >
              https://thesignal.gmkwebsolutions.com
            </a>
            . By accessing or using the Service, you agree to the practices described in this
            policy.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>

          <h3 className="font-medium mb-2">2.1 Account &amp; Profile Information</h3>
          <p className="text-muted-foreground leading-relaxed mb-4">
            When you create an account we collect your name, email address, business name, and a
            password (stored as a one-way hash). If you register or sign in via a third-party OAuth
            provider (Facebook, Google, or LinkedIn) we receive the profile data that provider
            makes available under the permissions you grant, such as your name and email address.
          </p>

          <h3 className="font-medium mb-2">2.2 Connected Social Media Accounts</h3>
          <p className="text-muted-foreground leading-relaxed mb-4">
            To post on your behalf, we store the OAuth access tokens and refresh tokens issued by
            Facebook/Instagram (Meta), Google Business Profile, and LinkedIn after you authorize
            The Signal. We also store the platform-specific identifiers (page IDs, location IDs,
            etc.) necessary to publish content. We do not store your social media passwords.
          </p>

          <h3 className="font-medium mb-2">2.3 Content You Create</h3>
          <p className="text-muted-foreground leading-relaxed mb-4">
            We store the text, images, and scheduling metadata for posts you create or that our
            AI engine drafts on your behalf, so that we can publish them at the scheduled time.
          </p>

          <h3 className="font-medium mb-2">2.4 Usage &amp; Log Data</h3>
          <p className="text-muted-foreground leading-relaxed">
            We automatically collect standard server log information, including IP addresses,
            browser type, pages visited within the Service, and timestamps. This data is used
            solely for security monitoring and service reliability.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">
            3. Third-Party OAuth Authentication (Facebook, Google, LinkedIn)
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            The Signal uses the official OAuth 2.0 flows provided by Meta (Facebook/Instagram),
            Google, and LinkedIn to connect your social accounts. When you authorize a connection:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-3">
            <li>
              You are redirected to the third-party platform's own login and consent screen. We
              never see or handle your passwords for those platforms.
            </li>
            <li>
              We request only the minimum permissions required to read your page/location list and
              to publish posts on your behalf (e.g.,{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">pages_manage_posts</code>,{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                business.manage
              </code>
              ).
            </li>
            <li>
              The access tokens and refresh tokens we receive are stored encrypted in our database
              and used exclusively to publish your scheduled content.
            </li>
            <li>
              You can revoke The Signal's access at any time from your Facebook App Settings,
              Google Account Permissions, or LinkedIn Connected Apps page. Revoking access
              there will also stop any future publishing; you should also disconnect the account
              inside The Signal's Integrations settings.
            </li>
          </ul>
          <p className="text-muted-foreground leading-relaxed">
            Use of data obtained via Facebook Login complies with the{" "}
            <a
              href="https://developers.facebook.com/policy/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary"
            >
              Meta Platform Terms
            </a>{" "}
            and{" "}
            <a
              href="https://developers.facebook.com/devpolicy/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary"
            >
              Meta Developer Policies
            </a>
            . We do not sell or transfer Facebook user data to third parties and do not use it for
            advertising or user profiling.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">4. How We Use Your Information</h2>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>To create and maintain your account and authenticate your sessions.</li>
            <li>
              To publish posts to your connected social media accounts at the times you schedule.
            </li>
            <li>To generate AI-assisted content drafts on your behalf.</li>
            <li>To send transactional emails (account confirmations, password resets).</li>
            <li>To monitor service health, investigate errors, and prevent abuse.</li>
            <li>
              To comply with legal obligations or respond to lawful requests from public
              authorities.
            </li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-3">
            We do not sell your personal information. We do not use your data for targeted
            advertising or share it with ad networks.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">5. Data Sharing &amp; Disclosure</h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            We share data only in the following circumstances:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>
              <strong>Service providers:</strong> We use trusted sub-processors (database hosting,
              cloud storage, email delivery) solely to operate the Service. They are contractually
              prohibited from using your data for any other purpose.
            </li>
            <li>
              <strong>Social platforms:</strong> Content and tokens are transmitted to Facebook,
              Instagram, Google, and LinkedIn APIs only as necessary to publish your posts.
            </li>
            <li>
              <strong>Legal requirements:</strong> We may disclose information if required by law,
              subpoena, or to protect the rights and safety of GMK Web Solutions or others.
            </li>
            <li>
              <strong>Business transfer:</strong> In the event of a merger, acquisition, or sale of
              assets, user data may be transferred as part of that transaction, with notice provided
              to affected users.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">6. Data Retention</h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            We retain your data for as long as your account is active or as needed to provide the
            Service:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>
              <strong>Account data</strong> is retained until you request account deletion.
            </li>
            <li>
              <strong>Published post records</strong> (text, metadata, platform post IDs) are
              retained for up to 24 months after posting to support analytics and content history.
            </li>
            <li>
              <strong>OAuth tokens</strong> are deleted immediately when you disconnect a social
              account or delete your account.
            </li>
            <li>
              <strong>Server logs</strong> are retained for up to 90 days for security purposes.
            </li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-3">
            Upon account deletion we permanently remove your personal data within 30 days, except
            where retention is required by law.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">7. Data Security</h2>
          <p className="text-muted-foreground leading-relaxed">
            We implement industry-standard security measures including TLS encryption in transit,
            encrypted storage for OAuth tokens, hashed passwords, and restricted access controls.
            No method of transmission over the Internet is 100% secure; we cannot guarantee
            absolute security but are committed to protecting your information using commercially
            reasonable means.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">8. Your Rights &amp; Choices</h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Depending on your location, you may have the following rights:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>
              <strong>Access &amp; Portability:</strong> Request a copy of the personal data we
              hold about you.
            </li>
            <li>
              <strong>Correction:</strong> Request that inaccurate data be corrected.
            </li>
            <li>
              <strong>Deletion:</strong> Request deletion of your account and associated personal
              data.
            </li>
            <li>
              <strong>Revocation:</strong> Disconnect any connected social account at any time from
              the Integrations settings page.
            </li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-3">
            To exercise any of these rights, contact us at{" "}
            <a href="mailto:privacy@gmkwebsolutions.com" className="underline hover:text-primary">
              privacy@gmkwebsolutions.com
            </a>
            .
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">9. Cookies &amp; Tracking</h2>
          <p className="text-muted-foreground leading-relaxed">
            The Signal uses only essential session cookies required for authentication and
            application state. We do not use advertising cookies, third-party tracking pixels, or
            behavioral analytics tools.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">10. Children's Privacy</h2>
          <p className="text-muted-foreground leading-relaxed">
            The Service is not directed to children under 13. We do not knowingly collect personal
            information from children under 13. If you believe a child has provided us with
            personal data, please contact us and we will delete it promptly.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">11. Changes to This Policy</h2>
          <p className="text-muted-foreground leading-relaxed">
            We may update this Privacy Policy from time to time. When we do, we will revise the
            "Last Updated" date at the top of the page and, where appropriate, notify users by
            email or an in-app notice. Continued use of the Service after changes take effect
            constitutes acceptance of the revised policy.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">12. Contact Us</h2>
          <p className="text-muted-foreground leading-relaxed">
            If you have questions, concerns, or requests regarding this Privacy Policy, please
            contact:
          </p>
          <address className="mt-3 text-muted-foreground not-italic leading-relaxed">
            <strong>GMK Web Solutions</strong>
            <br />
            Operator of The Signal
            <br />
            <a href="mailto:privacy@gmkwebsolutions.com" className="underline hover:text-primary">
              privacy@gmkwebsolutions.com
            </a>
          </address>
        </section>

        <p className="text-xs text-muted-foreground border-t pt-6 mt-10">
          &copy; {new Date().getFullYear()} GMK Web Solutions. All rights reserved.
        </p>
      </div>
    </div>
  );
}
