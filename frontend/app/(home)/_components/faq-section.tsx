"use client";

import { Minus, Plus } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { TextReveal } from "./reveal-on-view";

const faqItems = [
  {
    question: "What type of tours does Ancient Trails offer?",
    answer:
      "Ancient Trails offers heritage tours across India and the world, including Indian heritage trails, international tours, specialized tours, customized tours and corporate or MICE tours.",
  },
  {
    question: "Can Ancient Trails customize a tour for me?",
    answer:
      "Yes. You can share your destination, dates, interests and budget, and the team can shape a customized itinerary around your travel style.",
  },
  {
    question: "Are the tours educational or leisure-based?",
    answer:
      "The tours blend learning with leisure, pairing expert-led heritage context with comfortable pacing, curated stays and relaxed travel experiences.",
  },
  {
    question: "Does Ancient Trails arrange corporate tours?",
    answer:
      "Yes. Ancient Trails can arrange corporate, MICE and group tours with planning support, guided experiences and suitable itineraries.",
  },
  {
    question: "Does Ancient Trails offer tours for special interest groups?",
    answer:
      "Yes. Specialised tours can be planned for dancers, photographers, artists, architects, archaeology enthusiasts, history lovers, foodies, students and cultural groups.",
  },
  {
    question: "What makes Ancient Trails different from regular tourism companies?",
    answer:
      "Ancient Trails focuses on deeper discovery through mentor-led trails, expert inputs, heritage-first storytelling, careful planning and experiences shaped around traveller interests.",
  },
];

export function FaqSection() {
  return (
    <section id="faqs" className="bg-background pb-16">
      <div className="bg-[#fbf0e8]">
        <div className="mx-auto grid w-full max-w-[1300px] content-center gap-6 px-5 py-8 sm:px-0 lg:grid-cols-[330px_580px] lg:items-start lg:gap-[68px]">
          <TextReveal>
            <h2 className="max-w-[700px] font-heading text-[32px] font-bold leading-[0.98] text-secondary sm:text-[36px]">
              Frequently Asked Questions
            </h2>
          </TextReveal>
          <TextReveal delay={160}>
            <p className="max-w-[600px] text-description italic text-secondary">
              Ancient Trails offers heritage tours across India and the world,
              including Indian heritage trails, international tours, specialized
              tours, customized tours, and corporate/MICE tours.
            </p>
          </TextReveal>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1300px] px-5 pt-9 sm:px-0">
        <Accordion
          multiple={false}
          className="grid items-start gap-x-6 gap-y-5 md:grid-cols-2"
        >
          {faqItems.map((item) => (
            <AccordionItem
              key={item.question}
              value={item.question}
              className="rounded-[10px] border border-border/70 bg-white shadow-[0_3px_8px_rgba(50,50,50,0.12)]"
            >
              <AccordionTrigger className="min-h-[46px] items-center gap-3 px-4 py-3 font-sans text-[15px] italic no-underline hover:no-underline sm:gap-4 sm:px-5 sm:text-description [&_[data-slot=accordion-trigger-icon]]:hidden cursor-pointer">
                <span className="font-sans text-[15px] font-normal italic sm:text-description">
                  {item.question}
                </span>
                <span className="ml-auto grid size-5 shrink-0 place-items-center text-description">
                  <Plus className="size-4 group-aria-expanded/accordion-trigger:hidden" />
                  <Minus className="hidden size-4 group-aria-expanded/accordion-trigger:block" />
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-4 font-sans text-description italic">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
