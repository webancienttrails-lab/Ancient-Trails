"use client";

import { SiteLogo } from "@/components/site-logo";
import { useEffect, useState } from "react";
import { defaultSiteContactSettings, getContactEmailDisplay, getMailtoHref, getPublicSiteSettings, getTelephoneHref, type SiteContactSettings, type SiteSocialLinks } from "@/lib/site-settings";
import { SocialMediaIcon } from "@/components/ui/social-media-icon";
import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  Compass,
  CreditCard,
  Globe2,
  Mail,
  MapPin,
  Phone,
  Heart,
  Map,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

const footerColumns: Array<{
  title: string;
  icon: LucideIcon;
  links: Array<{ label: string; href: string }>;
}> = [
  {
    title: "Explore",
    icon: Compass,
    links: [
       { label: "Long Trails", href: "/tours" },
       { label: "Short Trails", href: "/short-trails" },
      { label: "Experiences", href: "/experiences" },
      { label: "Destination", href: "/destinations" },
      { label: "Tour Experts", href: "/experts" },
      { label: "Tour Calendar", href: "/tour-calendar" }
    ],
  },
  {
    title: "Company",
    icon: Map,
    links: [
      { label: "About Us", href: "/#about" },
      { label: "Travel Blog", href: "/blog" },
      { label: "Terms & Conditions", href: "/terms-and-conditions" },
      { label: "Privacy Policy", href: "/privacy-policy" },
      { label: "FAQs", href: "/faq" },
      { label: "Contact Us", href: "/contact" },
    ],
  },
];

const socialItems: Array<{ platform: keyof SiteSocialLinks; label: string }> = [
  { platform: "facebook", label: "Facebook" },
  { platform: "instagram", label: "Instagram" },
  { platform: "linkedin", label: "LinkedIn" },
  { platform: "youtube", label: "YouTube" },
];

const trustItems: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: "Best Price Guarantee",
    description: "We ensure you get the best price for your tour.",
    icon: ShieldCheck,
  },
  {
    title: "Secure Payments",
    description: "Your payments are safe with us.",
    icon: CreditCard,
  },
  {
    title: "Trusted by Thousands",
    description: "Thousands of happy travelers travel with us every year.",
    icon: BadgeCheck,
  },
  {
    title: "Worldwide Support",
    description: "We're here to help you anytime, anywhere.",
    icon: Globe2,
  },
];

function FooterColumn({
  icon: Icon,
  links,
  title,
}: {
  icon: LucideIcon;
  links: Array<{ label: string; href: string }>;
  title: string;
}) {
  return (
    <section className="min-w-0 border-t border-primary/35 pt-4 lg:border-l lg:border-t-0 lg:pl-9 lg:pt-6">
      <h2 className="flex items-center gap-2 font-heading text-[17px] font-bold leading-none text-[#f1dfcc] lg:gap-3 lg:text-[20px]">
        <Icon className="size-5 text-primary lg:size-6" strokeWidth={1.7} />
        {title}
      </h2>
      <ul className="mt-3 space-y-2 font-sans text-[13px] leading-snug text-[#ead8c3]/82 lg:mt-5 lg:space-y-3 lg:text-[13px] lg:leading-none">
        {links.map((link) => (
          <li key={`${title}-${link.label}`}>
            <Link
              href={link.href}
              className="inline-block py-1 transition-colors hover:text-primary lg:py-0"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FooterContact({ contact }: { contact: SiteContactSettings }) {
  const address = contact.officeAddress.trim() || defaultSiteContactSettings.officeAddress;
  const email = getContactEmailDisplay(contact);
  const phones = [...new Set([contact.primaryCalling, contact.secondaryCalling, contact.landline].map(value => value.trim()).filter(Boolean))];
  return (
    <section className="col-span-2 min-w-0 border-t border-primary/35 pt-4 lg:col-span-1 lg:border-l lg:border-t-0 lg:pl-9 lg:pt-6">
      <h2 className="flex items-center gap-2 font-heading text-[17px] font-bold leading-none text-[#f1dfcc] lg:gap-3 lg:text-[20px]">
        <MapPin className="size-5 text-primary lg:size-6" strokeWidth={1.7} />Contact Info
      </h2>
      <address className="mt-3 space-y-3 font-sans text-[13px] not-italic leading-relaxed text-[#ead8c3]/82 lg:mt-5">
        <a href={"https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(address)} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 transition-colors hover:text-primary">
          <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
          <span className="min-w-0 whitespace-pre-line break-words">{address}</span>
        </a>
        {phones.length > 0 && <div className="flex items-start gap-2">
          <Phone aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
          <div className="min-w-0">{phones.map(phone => <a key={phone} href={getTelephoneHref(phone)} className="block w-fit py-1 transition-colors hover:text-primary lg:py-0">{phone}</a>)}</div>
        </div>}
        <a href={getMailtoHref(email)} className="flex items-start gap-2 py-1 transition-colors hover:text-primary lg:py-0">
          <Mail aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
          <span className="min-w-0 break-all">{email}</span>
        </a>
      </address>
    </section>
  );
}

function TrustItem({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <article className="flex min-w-0 items-start gap-2 px-1 py-2 sm:items-center sm:gap-4 sm:px-4 sm:py-3 lg:px-8">
      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-primary/55 bg-white/70 text-primary sm:size-14">
        <Icon className="size-4 sm:size-7" strokeWidth={1.7} />
      </span>
      <span className="min-w-0">
        <span className="block font-sans text-[11px] font-bold leading-tight text-secondary sm:text-[13px]">
          {title}
        </span>
        <span className="mt-1 block max-w-[210px] font-sans text-[10px] leading-[1.35] text-secondary/78 sm:mt-1.5 sm:text-[12px] sm:leading-[1.45]">
          {description}
        </span>
      </span>
    </article>
  );
}

export function SiteFooter() {
  const [contact, setContact] = useState<SiteContactSettings>(defaultSiteContactSettings);
  const [socialLinks, setSocialLinks] = useState<SiteSocialLinks>({ facebook: "", instagram: "", linkedin: "", youtube: "" });
  useEffect(() => {
    let mounted = true;
    getPublicSiteSettings().then(response => {
      if (mounted) {
        setSocialLinks(current => ({ ...current, ...response.data.settings.socialLinks }));
        setContact(current => ({ ...current, ...response.data.settings.contact }));
      }
    }).catch(() => { /* Keep navigation available if optional social links cannot be loaded. */ });
    return () => { mounted = false; };
  }, []);
  return (
    <footer className="relative overflow-hidden">
      <Image
        src="/Footer.webp"
        alt=""
        fill
        sizes="100vw"
        className="object-cover object-bottom lg:object-fill"
      />
      <div className="relative">
        <section className="relative overflow-hidden">
          <div className="relative mx-auto grid w-full max-w-[1440px] grid-cols-2 gap-x-5 gap-y-6 px-4 pb-7 pt-6 sm:px-8 sm:pb-10 sm:pt-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-9 lg:px-12 lg:pb-16 lg:pt-14 xl:px-16">
            <section className="col-span-2 lg:col-span-1">
              <Link href="/" aria-label="Ancient Trails home" className="inline-block">
                <SiteLogo
                  alt="Ancient Trails"
                  width={218}
                  height={86}
                  className="h-11 w-auto lg:h-16"
                />
              </Link>
              <p className="mt-3 max-w-[255px] font-sans text-[12px] leading-[1.55] text-[#ead8c3]/82 lg:mt-7 lg:text-[15px] lg:leading-[1.65]">
                Crafting meaningful journeys that connect you with the world, its
                people and its stories.
              </p>
              <div className="mt-4 flex w-[170px] items-center gap-2 text-primary lg:mt-6 lg:w-[220px] lg:gap-3">
                <span className="h-px flex-1 bg-primary/60" />
                <span className="size-1 rotate-45 bg-primary lg:size-1.5" />
                <span className="size-1 rotate-45 bg-primary lg:size-1.5" />
                <span className="size-1 rotate-45 bg-primary lg:size-1.5" />
                <span className="h-px flex-1 bg-primary/60" />
              </div>
              <div className="mt-4 flex items-center gap-3 lg:mt-7 lg:gap-4">
                {socialItems.filter(item => socialLinks[item.platform]?.trim()).map(item => (
                  <a key={item.platform} href={socialLinks[item.platform]} target="_blank" rel="noopener noreferrer" aria-label={item.label}
                    className="grid size-8 place-items-center rounded-full border border-[#9b673b]/70 bg-[#221811]/80 text-[#ead8c3] transition-colors hover:border-primary hover:bg-primary hover:text-white lg:size-10">
                    <SocialMediaIcon platform={item.platform} className="size-4 lg:size-5" />
                  </a>
                ))}
              </div>
            </section>

            {footerColumns.map((column) => (
              <FooterColumn key={column.title} {...column} />
            ))}
            <FooterContact contact={contact} />


          </div>
        </section>

        <section className="relative text-secondary">
          <div className="mx-auto grid w-full max-w-[1440px] grid-cols-2 gap-x-2 gap-y-1 px-4 py-3 sm:px-8 sm:py-6 md:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-[#d9a06f]/55 lg:px-12 xl:px-16">
            {trustItems.map((item) => (
              <TrustItem key={item.title} {...item} />
            ))}
          </div>
        </section>

        <section className="relative text-[#ead8c3]/78">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-2 px-4 py-3 text-center font-sans text-[10px] sm:px-8 sm:py-5 sm:text-[12px] lg:flex-row lg:items-center lg:justify-between lg:px-12 lg:text-left xl:px-16">
            <p>&copy; 2026 Ancient Trails | All rights reserved</p>
            <p className="flex items-center justify-center gap-3">
              <span className="hidden h-px w-20 bg-primary/45 sm:block" />
              <span className="inline-flex items-center gap-2">
                Made with <Heart className="size-4 fill-primary text-primary" /> for
                travelers
              </span>
              <span className="hidden h-px w-20 bg-primary/45 sm:block" />
            </p>
            <p>Powered by ADVOLVE</p>
          </div>
        </section>
      </div>
    </footer>
  );
}
