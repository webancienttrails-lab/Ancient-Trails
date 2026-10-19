"use client";

import { useEffect, useState } from "react";
import { getPublicFaq, type FaqCategory } from "@/lib/faq";
import { Minus, Plus } from "lucide-react";

import { Header } from "@/components/layout/header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function FaqPage() {
  const [faqCategories, setFaqCategories] = useState<FaqCategory[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let mounted = true;
    getPublicFaq().then(response => {
      if (!mounted) return;
      setFaqCategories(response.data.faq.categories.filter(category => category.items.length > 0));
      setStatus("ready");
    }).catch(() => { if (mounted) setStatus("error"); });
    return () => { mounted = false; };
  }, [reload]);
  useEffect(() => {
    if (status !== "ready" || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }, [status]);
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-325 px-5 py-4 sm:px-6 lg:px-0">
        <Header />
      </div>

      <main className="border-t border-primary/10">
        <div className="mx-auto w-full max-w-275 px-5 py-12 sm:px-8 lg:py-16">
          <div className="max-w-2xl">
            <h1 className="mt-0 font-heading text-[32px] font-bold leading-tight text-secondary sm:text-[46px] sm:leading-none">
              Frequently Asked Questions
            </h1>
            <p className="mt-5 text-[15px] leading-[1.8] text-secondary/70 sm:text-[16px]">
              Find clear answers about our tours, bookings, hotels, food,
              transport and cancellation policies.
            </p>
          </div>

          <div className="mt-12 space-y-12">
            {status === "loading" ? <p role="status" className="text-sm text-secondary/60">Loading FAQs...</p> : null}
            {status === "error" ? <div role="alert" className="text-sm text-secondary/70"><p>FAQs could not be loaded. Please try again.</p><button type="button" onClick={() => { setStatus("loading"); setReload(value => value + 1); }} className="mt-3 font-semibold text-primary underline">Retry</button></div> : null}
            {status === "ready" && !faqCategories.length ? <p className="text-sm text-secondary/60">FAQs will be available soon.</p> : null}
            {faqCategories.map((category) => (
              <section key={category.id} id={category.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")} className="scroll-mt-8">
                <h2 className="font-heading text-[23px] font-bold leading-tight text-secondary sm:text-[30px]">
                  {category.title}
                </h2>
                <Accordion
                  multiple={false}
                  className="mt-5 border-t border-primary/20"
                >
                  {category.items.map((item) => (
                    <AccordionItem
                      key={item.id}
                      value={item.id}
                      className="border-b border-primary/15"
                    >
                      <AccordionTrigger className="min-h-14.5 gap-3 px-1 py-4 font-sans text-[14px] font-semibold leading-snug text-secondary no-underline hover:no-underline sm:gap-4 sm:text-[16px] sm:leading-normal **:data-[slot=accordion-trigger-icon]:hidden">
                        <span>{item.question}</span>
                        <span className="ml-auto grid size-7 shrink-0 place-items-center rounded-full bg-[#fbf0e8] text-primary">
                          <Plus className="size-4 group-aria-expanded/accordion-trigger:hidden" />
                          <Minus className="hidden size-4 group-aria-expanded/accordion-trigger:block" />
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="max-w-3xl whitespace-pre-line px-1 pb-5 text-[14px] leading-[1.8] text-secondary/75 sm:text-[15px]">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>
            ))}
          </div>
        </div>
      </main>

    </div>
  );
}
