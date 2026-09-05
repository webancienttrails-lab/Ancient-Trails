import { Mail, MapPin, Phone, Send, Users } from "lucide-react";
import Link from "next/link";

import { Header } from "@/components/layout/header";
import { Button, ButtonArrow } from "@/components/ui/button";

const GOOGLE_MAPS_EMBED_URL =
  "https://www.google.com/maps?q=Ancient+Trails+Pune&output=embed";

const contactMethods = [
  {
    title: "Call Us",
    detail: "+91 7272 90 0606",
    note: "Mon - Sat\n9:00 AM - 6:00 PM",
    icon: Phone,
  },
  {
    title: "Email Us",
    detail: "admin@ancient-trails.com",
    note: "We usually respond\nwithin 24 hours",
    icon: Mail,
  },
  {
    title: "General Enquiries",
    detail: "info@ancient-trails.com",
    note: "For tours, partnerships\nand other queries",
    icon: Send,
  },
  {
    title: "Partner With Us",
    detail: "business@ancient-trails.com",
    note: "For collaborations\nand partnerships",
    icon: Users,
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-325 px-5 py-4 sm:px-6 lg:px-0">
        <Header />
      </div>

      <main className="border-t border-primary/10">
        <div className="mx-auto w-full max-w-325 px-5 py-10 sm:px-8 lg:py-14">
          <section className="grid gap-10 lg:grid-cols-[0.82fr_1fr] lg:items-start lg:gap-16">
            <div className="pt-2">
              <p className="text-eyebrow font-medium uppercase tracking-normal text-primary">
                Contact Ancient Trails
              </p>
              <h1 className="mt-2 max-w-97.5 font-heading text-[32px] font-bold leading-none text-secondary sm:text-title">
                Let&apos;s Plan
                <br />
                Your Next <span className="text-primary">Journey</span>
              </h1>
              <div className="mt-5 h-0.5 w-8 bg-primary" />
              <p className="mt-5 max-w-95 text-description text-secondary/65">
                Have a question, a special request, or need help choosing the
                right tour? Share your details and we&apos;ll get back to you as
                soon as possible.
              </p>
            </div>

            <ContactForm />
          </section>

          <section className="mt-16 grid gap-8 lg:grid-cols-[0.82fr_1fr] lg:items-center lg:gap-16">
            <div>
              <p className="text-eyebrow font-medium uppercase tracking-normal text-primary">
                Our Offices
              </p>
              <h2 className="mt-2 font-heading text-title font-bold leading-none text-secondary">
                Find Us <span className="text-primary">Here</span>
              </h2>
              <p className="mt-4 max-w-87.5 text-description text-secondary/65">
                Visit us at our office or get in touch with our team directly.
                We&apos;re always happy to welcome fellow travelers.
              </p>
              <div className="mt-5 flex max-w-102.5 gap-4 bg-[#fbf0e8] px-5 py-5">
                <MapPin className="mt-1 size-7 shrink-0 text-primary" />
                <div className="text-[13px] leading-[1.45] text-secondary/70">
                  <p className="font-bold text-secondary">Registered Office</p>
                  <p>387/1, Vinayak Apartments</p>
                  <p>Narayan Peth, Near Modi Ganpati Temple</p>
                  <p>Pune - 411030, Maharashtra, India</p>
                </div>
              </div>
            </div>

            <div className="relative min-h-58.75 overflow-hidden rounded-lg bg-[#efe1d2] sm:min-h-71.25">
              <div className="absolute inset-0 bg-[url('/home%20assets/About_trails.webp')] bg-cover bg-center" />
              <div className="absolute inset-0 bg-[#6f3518]/10" />
              <div className="relative flex h-full min-h-58.75 items-end p-6 sm:min-h-71.25">
                <p className="max-w-60 font-heading text-[25px] font-bold leading-none text-white drop-shadow-sm sm:text-[31px]">
                  Ancient Trails
                </p>
              </div>
            </div>
          </section>
        </div>

        <section className="relative overflow-hidden bg-[#fbf0e8]">
          <div className="relative mx-auto grid w-full max-w-325 gap-8 px-5 py-9 sm:px-8 lg:grid-cols-[0.82fr_1fr] lg:items-center lg:gap-16 lg:py-11">
            <div>
              <p className="text-eyebrow font-medium uppercase tracking-normal text-primary">
                Our Location
              </p>
              <h2 className="mt-2 font-heading text-title font-bold leading-none text-secondary">
                On the <span className="text-primary">Map</span>
              </h2>
              <p className="mt-3 text-description text-secondary/65">
                Find our exact location on Google Maps.
              </p>
              <Button
                nativeButton={false}
                render={
                  <Link
                    href="https://maps.google.com/?q=Ancient+Trails+Pune"
                    target="_blank"
                    rel="noreferrer"
                  />
                }
                className="mt-5 h-11 w-full justify-between px-5 text-[15px] font-normal sm:w-auto sm:gap-6 sm:px-6 sm:text-button"
              >
                Get Directions
                <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
              </Button>
            </div>
            <div className="relative h-56 overflow-hidden rounded-lg border border-primary/15 bg-white sm:h-64 lg:h-72">
              <iframe
                title="Ancient Trails location on Google Maps"
                src={GOOGLE_MAPS_EMBED_URL}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0 size-full border-0"
              />
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-325 px-5 py-10 sm:px-8 lg:py-12">
          <section>
            <p className="text-eyebrow font-medium uppercase tracking-normal text-primary">
              Other Ways To Reach Us
            </p>
            <h2 className="mt-2 font-heading text-title font-bold leading-none text-secondary">
              We&apos;re Just a <span className="text-primary">Message</span> Away
            </h2>
            <p className="mt-3 text-description text-secondary/65">
              Prefer to connect in a different way? Here are other ways to reach us.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {contactMethods.map((method) => {
                const Icon = method.icon;
                return (
                  <article key={method.title} className="bg-[#fbf0e8] px-4 py-5 text-center">
                    <Icon className="mx-auto size-7 text-primary" />
                    <h3 className="mt-3 text-[12px] font-bold text-secondary">
                      {method.title}
                    </h3>
                    <p className="mt-1 wrap-break-word text-[12px] font-semibold text-secondary">
                      {method.detail}
                    </p>
                    <div className="mx-auto my-3 h-px w-2/3 bg-primary/15" />
                    <p className="whitespace-pre-line text-[12px] leading-normal text-secondary/60">
                      {method.note}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function ContactForm() {
  return (
    <form className="border border-primary/15 bg-white p-4 shadow-[0_8px_28px_rgba(82,44,17,0.06)] sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full Name" required placeholder="Enter your name" />
        <Field label="Email Address" required type="email" placeholder="Enter your email" />
        <Field label="Phone Number" placeholder="Enter your phone number" />
        <label className="grid gap-1.5 text-description font-medium text-secondary">
          Subject
          <select className="h-10 w-full border border-secondary/10 bg-white px-3 text-description font-normal text-secondary/55 outline-none transition-colors focus:border-primary">
            <option value="">Select a subject</option>
            <option>Tour enquiry</option>
            <option>Customized travel</option>
            <option>Partnership</option>
            <option>General enquiry</option>
          </select>
        </label>
      </div>
      <label className="mt-4 grid gap-1.5 text-description font-medium text-secondary">
        Your Message
        <textarea
          required
          rows={4}
          placeholder="Tell us more about your requirements..."
          className="w-full resize-y border border-secondary/10 px-3 py-3 text-description font-normal text-secondary outline-none placeholder:text-secondary/35 focus:border-primary"
        />
      </label>
      <Button
        type="submit"
        className="mt-4 h-11 w-full justify-between px-5 text-[15px] font-normal sm:w-auto sm:gap-6 sm:px-6 sm:text-button"
      >
        Send Message
        <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
      </Button>
    </form>
  );
}

function Field({
  label,
  placeholder,
  required = false,
  type = "text",
}: {
  label: string;
  placeholder: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="grid gap-1.5 text-description font-medium text-secondary">
      {label}
      <input
        required={required}
        type={type}
        placeholder={placeholder}
        className="h-10 w-full border border-secondary/10 px-3 text-description font-normal text-secondary outline-none placeholder:text-secondary/35 focus:border-primary"
      />
    </label>
  );
}
