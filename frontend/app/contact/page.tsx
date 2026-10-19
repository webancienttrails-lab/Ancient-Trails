import {
  ArrowRight, ArrowUpRight, BookUser, Building2, BusFront, CreditCard,
  FileText, Headset, Heart, Mail, MapPin, Phone, Plane,
  RefreshCw, Users, Utensils,
} from "lucide-react";
import Link from "next/link";

import { ContactForm } from "@/components/contact/contact-form";
import { Header } from "@/components/layout/header";
import {
  defaultSiteContactSettings, getContactEmailDisplay, getMailtoHref,
  getPublicSiteSettings, getTelephoneHref,
} from "@/lib/site-settings";

const frame = "mx-auto w-full max-w-[1280px] px-5 sm:w-[90%] sm:px-6 lg:w-[88%] lg:px-8";
const eyebrow = "text-[13px] font-semibold uppercase text-primary sm:text-[14px]";
const heading = "font-heading text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-secondary sm:text-[40px]";

const features = [
  { title: "Expert Guidance", description: "Get personalised travel advice", icon: Headset },
  { title: "Customised Itineraries", description: "Tours designed around your interests", icon: FileText },
  { title: "Friendly Support", description: "We're here to help at every step", icon: Heart },
];

const helpTopics = [
  { title: "General FAQ", icon: FileText },
  { title: "Air/Train Booking", icon: Plane },
  { title: "Booking / Payment", icon: CreditCard },
  { title: "Cancellation / Refunds", icon: RefreshCw },
  { title: "Hotels", icon: Building2 },
  { title: "Food", icon: Utensils },
  { title: "Local Transport", icon: BusFront },
  { title: "Passport/VISA/Insurance", icon: BookUser },
];

function WhatsAppIcon({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20.5 11.6a8.6 8.6 0 0 1-12.7 7.6L3 20.5l1.3-4.6A8.6 8.6 0 1 1 20.5 11.6Z" />
      <path d="m8 7.5 1.4-.3 1.2 2.5-1 1.1a9 9 0 0 0 3.6 3.5l1.1-1 2.4 1.2-.3 1.5c-.3.8-1.3 1.2-2.2.9-3.9-1.2-6.8-4.2-7.1-7.3-.1-.9.2-1.7.9-2.1Z" />
    </svg>
  );
}

export default async function ContactPage() {
  const contact = await getPublicSiteSettings()
    .then((response) => response.data.settings.contact)
    .catch(() => defaultSiteContactSettings);
  const officeAddress = contact.officeAddress || defaultSiteContactSettings.officeAddress;
  const phone = contact.primaryCalling || defaultSiteContactSettings.primaryCalling;
  const email = getContactEmailDisplay(contact);
  const whatsapp = contact.whatsapp || phone;
  const whatsappNumber = whatsapp.split(/[\/,;|]/)[0].replace(/\D/g, "");
  const whatsappHref = `https://wa.me/${whatsappNumber.length === 10 ? `91${whatsappNumber}` : whatsappNumber}`;
  const mapQuery = encodeURIComponent(`Ancient Trails, ${officeAddress}`);
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
  const contactMethods = [
    { title: "Call Us", detail: phone, href: getTelephoneHref(phone), note: "Primary calling\nMon - Sat, 10:00 AM - 6:00 PM", icon: Phone },
    { title: "Email Us", detail: email, href: getMailtoHref(email), note: "We usually respond\nwithin 24 hours", icon: Mail },
    { title: "WhatsApp", detail: whatsapp, href: whatsappHref, note: "Quick tour assistance\nand booking help", icon: WhatsAppIcon },
    { title: "Landline", detail: contact.landline || contact.secondaryCalling || "Contact our team", href: getTelephoneHref(contact.landline || contact.secondaryCalling || phone), note: "Secondary calling\nMon - Sat, 10:00 AM - 6:00 PM", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-325 px-5 py-4 sm:px-6 lg:px-0"><Header /></div>
      <main className="border-t border-primary/10">
        <section className={`${frame} grid grid-cols-1 gap-9 py-10 md:grid-cols-[0.65fr_1fr] md:gap-10 lg:gap-16 lg:py-11`}>
          <div>
            <p className={eyebrow}>Contact Ancient Trails</p>
            <h1 className={`${heading} mt-2 sm:text-[44px]`}>Let&apos;s Plan<br />Your Next <span className="text-primary">Journey</span></h1>
            <div className="mt-4 h-0.5 w-9 bg-primary" />
            <p className="mt-5 max-w-[355px] text-[14px] leading-[1.55] text-secondary/65 sm:text-[15px]">Have a question, a special request, or need help choosing the right tour? Share your details and we&apos;ll get back to you as soon as possible.</p>
            <div className="mt-5 space-y-4">
              {features.map(({ title, description, icon: Icon }) => (
                <div key={title} className="flex items-center gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Icon className="size-7" strokeWidth={1.6} /></span>
                  <div><h2 className="font-sans text-[14px] font-bold text-secondary">{title}</h2><p className="mt-0.5 text-[13px] leading-relaxed text-secondary/65">{description}</p></div>
                </div>
              ))}
            </div>
          </div>
          <ContactForm />
        </section>

        <section className="bg-primary/5">
          <div className={`${frame} grid grid-cols-1 gap-8 py-10 md:grid-cols-[0.8fr_1fr] md:items-center md:gap-8 lg:gap-12`}>
            <div>
              <p className={eyebrow}>Our Offices</p>
              <h2 className={`${heading} mt-2`}>Find Us <span className="text-primary">Here</span></h2>
              <p className="mt-2 text-[14px] leading-relaxed text-secondary/70">Visit us at our office or get in touch with our team directly.<br className="hidden lg:block" /> We&apos;re always happy to welcome fellow travelers.</p>
              <div className="mt-4 flex gap-4 rounded-[10px] bg-white/60 px-5 py-5">
                <MapPin className="mt-0.5 size-12 shrink-0 text-primary" strokeWidth={1.5} />
                <div className="text-[14px] leading-relaxed text-secondary/80"><h3 className="font-sans font-bold text-secondary">Registered Office</h3><p className="whitespace-pre-line">{officeAddress}</p></div>
              </div>
            </div>
            <div className="relative h-[310px] overflow-hidden rounded-[12px] border border-primary/10 bg-white sm:h-[330px] md:h-full md:min-h-[310px]">
              <iframe title="Ancient Trails registered office on Google Maps" src={`https://www.google.com/maps?q=${mapQuery}&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="absolute inset-0 size-full border-0" />
              <a href={mapHref} target="_blank" rel="noopener noreferrer" className="absolute bottom-3 left-3 flex items-center gap-2 rounded-[10px] border border-primary/20 bg-white px-4 py-3 text-[12px] font-bold text-secondary shadow-sm transition-colors hover:bg-primary/5"><MapPin className="size-5 text-primary" />Open in Google Maps<ArrowUpRight className="size-4 text-primary" /></a>
            </div>
          </div>
        </section>

        <section className={`${frame} py-10`}>
          <p className={eyebrow}>Other Ways To Reach Us</p>
          <h2 className={`${heading} mt-2 sm:text-[38px]`}>We&apos;re Just a <span className="text-primary">Message</span> Away</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-secondary/65">Prefer to connect in a different way? Here are other ways to reach us.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {contactMethods.map(({ title, detail, href, note, icon: Icon }) => (
              <a key={title} href={href} target={title === "WhatsApp" ? "_blank" : undefined} rel={title === "WhatsApp" ? "noopener noreferrer" : undefined} className="group rounded-[8px] bg-primary/5 px-4 py-5 text-center transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary">
                <Icon className="mx-auto size-8 text-primary" strokeWidth={1.7} />
                <h3 className="mt-3 font-sans text-[12px] font-bold text-secondary">{title}</h3><p className="mt-1 break-all text-[12px] font-semibold text-secondary">{detail}</p>
                <div className="mx-auto my-3 h-px w-4/5 bg-primary/25" /><p className="whitespace-pre-line text-[12px] leading-normal text-secondary/65">{note}</p>
              </a>
            ))}
          </div>
        </section>

        <section className="bg-primary/5">
          <div className={`${frame} py-8`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div><p className={eyebrow}>Quick Help Topics</p><h2 className={`${heading} mt-1 text-[28px] sm:text-[34px]`}>Looking for Something <span className="text-primary">Specific?</span></h2><p className="mt-2 text-[13px] leading-relaxed text-secondary/80">Find answers to common questions or get in touch with the right team.</p></div>
              <Link href="/faq" className="inline-flex items-center gap-5 rounded-full bg-primary px-5 py-2.5 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-85">View All FAQs<ArrowRight className="size-4" /></Link>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              {helpTopics.map(({ title, icon: Icon }) => (
                <Link key={title} href={`/faq#${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")}`} className="flex min-h-[100px] flex-col items-center justify-center gap-3 rounded-[14px] bg-white px-2 py-4 text-center transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary"><Icon className="size-7 text-primary" strokeWidth={1.7} /><span className="text-[10px] font-semibold leading-snug text-secondary">{title}</span></Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
