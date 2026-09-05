import { Header } from "@/components/layout/header";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="mx-auto w-full max-w-325 px-5 py-4 sm:px-6 lg:px-0">
        <Header />
      </div>

      {/* Content */}
      <main className="border-t border-primary/10">
        <div className="mx-auto w-full max-w-275 px-5 py-12 sm:px-8 lg:py-16">
          <h1 className="font-heading text-[32px] font-bold leading-tight text-secondary sm:text-[46px] sm:leading-none">
            Privacy Policy
          </h1>

          <p className="mt-4 text-[14px] text-secondary/60">
            Last updated: 31 May 2020
          </p>

          <div className="mt-10 space-y-9 text-[14px] leading-[1.8] text-secondary/75 sm:text-[15px]">
            <div className="space-y-4">
              <p>
                Ancient Trails LLP (hereafter referred to as “Ancient Trails”,
                “we”, “us”, or “our”) recognises the importance of maintaining
                traveller&apos;s privacy (hereafter referred to as “you” or
                “your”).
              </p>

              <p>
                We value your privacy and appreciate your trust in us. This
                Privacy Policy describes how we treat user information collected
                through www.ancient-trails.com and through our online and
                offline customer channels.
              </p>

              <p>
                By visiting and/or using our website, you agree to this Privacy
                Policy.
              </p>

              <p>
                Ancient-trails.com is a property of Ancient Trails LLP, an
                Indian Company registered under Section 12(1) of the Limited
                Liability Partnership Act, 2008 having its registered office at
                387/1, Vinayak Apartments, Narayan Peth, Near Modi Ganpati
                Temple, Pune – 411030, Maharashtra.
              </p>
            </div>

            <Section title="Information We Collect">
              <p>
                <strong>Personal information.</strong> We might collect your
                name, email, mobile number, phone number, address, Date of Birth,
                Anniversary Date, Aadhar details, PAN details, Passport details,
                IP address, food preferences, health details relevant to your
                tour and other information required to provide our services.
              </p>

              <p>
                <strong>Payment and billing information.</strong> We may collect
                your billing name, billing address and payment method when you
                make a booking. We do not collect your Credit/Debit Card or Net
                Banking credentials directly on our website.
              </p>

              <p>
                <strong>Information you post.</strong> We may collect
                information you post publicly on our website or social media
                platforms associated with Ancient Trails.
              </p>

              <p>
                <strong>Other information.</strong> We may collect information
                such as your IP address, browser, operating system, device,
                referring website, pages visited and time spent on our website.
              </p>
            </Section>

            <Section title="How We Collect Information">
              <p>
                We collect information directly from you when you enquire about
                a tour, make a booking, contact us by phone or email, or interact
                with our website.
              </p>

              <p>
                We may also collect information passively using tools such as
                Google Analytics, cookies and similar technologies.
              </p>

              <p>
                We may receive certain information from third-party services
                when you interact with integrated features on our website.
              </p>
            </Section>

            <Section title="Use of Your Personal Information">
              <p>
                We may use your information to process bookings, contact you,
                respond to enquiries, improve our services, personalise your
                experience and provide travel-related communication.
              </p>

              <p>
                We may also use information for security, analytics,
                transactional communication and marketing activities where
                permitted by law.
              </p>

              <p>
                Photographs taken during tours may be used on our website,
                social media or branding material for promotional purposes.
              </p>
            </Section>

            <Section title="Sharing of Information With Third Parties">
              <p>
                We may share information with service providers who help us
                process bookings, payments, accommodation, transportation,
                communication and other travel-related services.
              </p>

              <p>
                We may also share information with event organisers, business
                partners or government authorities where necessary or required
                by law.
              </p>

              <p>
                Information may also be transferred as part of a merger,
                acquisition, restructuring or sale of all or part of our
                business.
              </p>
            </Section>

            <Section title="Email Opt-Out">
              <p>
                You can opt out of receiving promotional emails by contacting{" "}
                <a
                  href="mailto:unsubscribe@ancient-trails.com"
                  className="font-medium text-primary"
                >
                  unsubscribe@ancient-trails.com
                </a>
                .
              </p>

              <p>
                Even if you opt out of promotional messages, we may continue
                sending transactional communication regarding your bookings,
                payments or tours.
              </p>
            </Section>

            <Section title="Third Party Sites">
              <p>
                Our website may contain links to third-party websites. Ancient
                Trails does not control these websites and this Privacy Policy
                does not apply to their privacy practices.
              </p>
            </Section>

            <Section title="Log Files">
              <p>
                Ancient Trails may use standard server log files. Information
                may include IP addresses, browser type, Internet Service
                Provider, date and time, referring pages and other website usage
                information.
              </p>
            </Section>

            <Section title="Cookies and Web Beacons">
              <p>
                Ancient Trails may use cookies to store visitor preferences and
                understand how visitors use our website. This helps us improve
                the website and user experience.
              </p>
            </Section>

            <Section title="Grievance Officer">
              <p>
                In accordance with applicable Information Technology laws, the
                details of our Grievance Officer are:
              </p>

              <div className="mt-3">
                <p className="font-semibold text-secondary">
                  Mrs. Kavita Gokhale
                </p>
                <p>387/1, Narayan Peth, Vinayak Apartments</p>
                <p>Near Modi Ganpati Temple</p>
                <p>Pune - 411030, Maharashtra</p>

                <p className="mt-3">
                  Phone:{" "}
                  <a
                    href="tel:+917272900606"
                    className="font-medium text-primary"
                  >
                    +91 7272 90 0606
                  </a>
                </p>

                <p>
                  Email:{" "}
                  <a
                    href="mailto:admin@ancient-trails.com"
                    className="font-medium text-primary"
                  >
                    admin@ancient-trails.com
                  </a>
                </p>
              </div>
            </Section>

            <Section title="Updates to This Policy">
              <p>
                From time to time, we may update this Privacy Policy. Any
                material changes will be published on this page as required by
                law.
              </p>
            </Section>

            <Section title="Jurisdiction">
              <p>
                Any dispute arising under this Privacy Policy shall be governed
                by the laws of India.
              </p>
            </Section>

            <Section title="Consent">
              <p>
                By using our website, you consent to this Privacy Policy and
                agree to its applicable Terms & Conditions.
              </p>
            </Section>
          </div>
        </div>
      </main>

    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-heading text-[24px] font-bold text-secondary sm:text-[28px]">
        {title}
      </h2>

      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}