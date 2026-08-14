import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  Compass,
  CreditCard,
  Globe2,
  Headphones,
  Heart,
  Mail,
  Map,
  MessageCircle,
  Play,
  Send,
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
      { label: "All Tours", href: "/#upcoming-tours" },
      { label: "Experiences", href: "/experiences" },
      { label: "Destination Guide", href: "/destinations" },
      { label: "Heritage Tours", href: "/#upcoming-tours" },
      { label: "Cultural Tours", href: "/#upcoming-tours" },
      { label: "Customised Tours", href: "/#customised-tours" },
      { label: "Specialised Tours", href: "/#specialised-tours" },
      { label: "International Tours", href: "/#upcoming-tours" },
    ],
  },
  {
    title: "Company",
    icon: Map,
    links: [
      { label: "About Us", href: "/#about" },
      { label: "How we work", href: "/#about" },
      { label: "Why travel with us", href: "/#why-choose-us" },
      { label: "Travel Blog", href: "/blog" },
      { label: "Terms & Conditions", href: "#" },
      { label: "Privacy Policy", href: "#" },
    ],
  },
  {
    title: "Support",
    icon: Headphones,
    links: [
      { label: "FAQs", href: "/#faqs" },
      { label: "Booking Guide", href: "#" },
      { label: "Payment Policy", href: "#" },
      { label: "Cancellation Policy", href: "#" },
      { label: "Contact Us", href: "#" },
    ],
  },
];

const socialLinks = [
  { label: "Facebook", href: "https://www.facebook.com/", text: "f" },
  { label: "Instagram", href: "https://www.instagram.com/", text: "ig" },
  { label: "YouTube", href: "https://www.youtube.com/", icon: Play },
  { label: "WhatsApp", href: "https://www.whatsapp.com/", icon: MessageCircle },
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
    <section className="border-t border-primary/35 pt-4 lg:border-l lg:border-t-0 lg:pl-9 lg:pt-6">
      <h2 className="flex items-center gap-2 font-heading text-[17px] font-bold leading-none text-[#f1dfcc] lg:gap-3 lg:text-[20px]">
        <Icon className="size-5 text-primary lg:size-6" strokeWidth={1.7} />
        {title}
      </h2>
      <ul className="mt-3 space-y-2 font-sans text-[11px] leading-tight text-[#ead8c3]/82 lg:mt-5 lg:space-y-3 lg:text-[13px] lg:leading-none">
        {links.map((link) => (
          <li key={`${title}-${link.label}`}>
            <Link
              href={link.href}
              className="transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
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
          <div className="relative mx-auto grid w-full max-w-[1440px] grid-cols-2 gap-x-5 gap-y-5 px-4 pb-7 pt-6 sm:px-8 sm:pb-10 sm:pt-10 lg:grid-cols-[1.35fr_0.9fr_0.9fr_0.9fr_1.25fr] lg:gap-9 lg:px-12 lg:pb-16 lg:pt-14 xl:px-16">
            <section className="col-span-2 lg:col-span-1">
              <Link href="/" aria-label="Ancient Trails home" className="inline-block">
                <Image
                  src="/Header Logo.png"
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
                {socialLinks.map((item) => {
                  const Icon = "icon" in item ? item.icon : null;

                  return (
                    <Link
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={item.label}
                    className="grid size-8 place-items-center rounded-full border border-[#9b673b]/70 bg-[#221811]/80 font-sans text-[10px] font-bold uppercase text-[#ead8c3] transition-colors hover:border-primary hover:bg-primary hover:text-white lg:size-10 lg:text-[12px]"
                  >
                    {Icon ? (
                      <Icon
                        className="size-3.5 lg:size-4"
                          fill={item.label === "YouTube" ? "currentColor" : "none"}
                          strokeWidth={item.label === "YouTube" ? 0 : 1.8}
                        />
                      ) : (
                        item.text
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>

            {footerColumns.map((column) => (
              <FooterColumn key={column.title} {...column} />
            ))}

            <section className="col-span-2 border-t border-primary/35 pt-4 lg:col-span-1 lg:border-l lg:border-t-0 lg:pl-9 lg:pt-6">
              <h2 className="flex items-center gap-2 font-heading text-[17px] font-bold leading-none text-[#f1dfcc] lg:gap-3 lg:text-[20px]">
                <Mail className="size-5 text-primary lg:size-6" strokeWidth={1.7} />
                Newsletter
              </h2>
              <p className="mt-3 max-w-[265px] font-sans text-[11px] leading-[1.55] text-[#ead8c3]/82 lg:mt-5 lg:text-[13px] lg:leading-[1.7]">
                Get travel inspiration and exclusive offers straight to your
                inbox.
              </p>
              <div className="mt-3 flex h-10 max-w-[300px] overflow-hidden rounded-[7px] border border-[#8d5a32]/55 bg-[#261b14]/72 shadow-[0_14px_34px_rgba(0,0,0,0.2)] lg:mt-5 lg:h-12">
                <label className="sr-only" htmlFor="footer-newsletter-email">
                  Enter your email
                </label>
                <input
                  id="footer-newsletter-email"
                type="email"
                placeholder="Enter your email"
                className="min-w-0 flex-1 bg-transparent px-3 font-sans text-[11px] text-[#f5e8d8] outline-none placeholder:text-[#d7bfa8]/68 lg:px-4 lg:text-[13px]"
              />
              <button
                type="button"
                aria-label="Subscribe to newsletter"
                className="grid w-11 shrink-0 place-items-center bg-primary text-white transition-colors hover:bg-[#b95f17] lg:w-14"
              >
                <Send className="size-4 lg:size-5" strokeWidth={1.8} />
              </button>
            </div>
              <p className="mt-3 flex items-center gap-2 font-sans text-[10px] text-[#d7bfa8]/72 lg:mt-5 lg:text-[12px]">
                <ShieldCheck className="size-3.5 text-primary lg:size-4" strokeWidth={1.8} />
                No spam. Unsubscribe anytime.
              </p>
            </section>
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
