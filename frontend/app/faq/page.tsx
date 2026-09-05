"use client";

import { Minus, Plus } from "lucide-react";

import { Header } from "@/components/layout/header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type FaqItem = {
  question: string;
  answer: React.ReactNode;
};

type FaqCategory = {
  title: string;
  items: FaqItem[];
};

const faqCategories: FaqCategory[] = [
  {
    title: "General FAQ",
    items: [
      {
        question: "What would be the group size of tours?",
        answer: "Usually, the number of travelers would be limited to 20.",
      },
      {
        question: "Can I extend my stay while on a group tour?",
        answer: "Yes. You may extend your stay on your own expenses.",
      },
      {
        question: "Can I join a tour in a midway?",
        answer:
          "Yes. You may join a tour in midway in certain tours. Any deviation in the planned tour may incur additional charges. You may check the possibility of joining a tour midway by informing us while travel booking.",
      },
      {
        question: "Does the tour itinerary change in a tour?",
        answer:
          "Yes. Tour itinerary may change at times due to unforeseen circumstances pertaining to the airline, hotel, sightseeing, transport or due to any natural events. In case of such changes, travelers are notified in the tour itself.",
      },
      {
        question: "Do you have doctors on tour?",
        answer:
          "No. We do not appoint any doctor on tour. However, in case of necessities, such need will be sought after at local facility at your own expense. Tour manager carries a First Aid Kit prescribed by a doctor.",
      },
      {
        question:
          "Can we keep our passport and currency with tour manager or expert while on tour?",
        answer:
          "You cannot keep any of your documents or belongings with tour manager or an expert. You will be responsible for your own belongings. Tour manager will not be responsible for any kind of loss of baggage and will not be held liable for any of your loss of baggage/items.",
      },
      {
        question:
          "Can we skip the sightseeing on tour? Shall we get refund for skipped activities?",
        answer:
          "You can skip the sightseeing on tour however you are not entitled to encash those sightseeing or activities hence no refund or discount will be given on this basis.",
      },
      {
        question: "What things/clothes to carry on tour?",
        answer: (
          <div className="space-y-4">
            <p>Things to carry on tour:</p>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                ID proof: Aadhar Card, Voters ID, Driving License for domestic
                tours and Indian nationals; valid passport for international
                tours and foreign nationals.
              </li>
              <li>Airline tickets, insurance copies if opted, and tour itinerary.</li>
              <li>
                Foreign currency in the form of notes, Forex Card or
                international credit/debit card for international tours.
              </li>
              <li>
                Accessories such as a cap, scarf, belts, sunglasses, cell
                phone, charger, adapter, power banks, camera, spare batteries
                and folding umbrella.
              </li>
              <li>Medicines.</li>
              <li>Comfortable footwear.</li>
              <li>
                Toiletries such as cold creams, body lotions, perfumes,
                toothbrush and toothpaste.
              </li>
              <li>Pen, book or notepad for the local journey.</li>
            </ol>
            <p>Clothes to carry:</p>
            <ol className="list-decimal space-y-2 pl-6">
              <li>Comfortable clothing, undergarments, sleepwear, handkerchief and socks.</li>
              <li>Thermal wear, woollen jackets, sweaters and pullovers for cold weather conditions.</li>
            </ol>
          </div>
        ),
      },
    ],
  },
  {
    title: "Booking and Payment Related FAQ",
    items: [
      {
        question: "Can I make the full payment for the tour booking at the time of booking itself?",
        answer:
          "Yes. You may pay the full amount of your tour in advance. As a result you may be entitled to get a good discount on your tour.",
      },
      {
        question: "If I wish to do the partial payment of tour, then is there an option?",
        answer:
          "Yes. You can confirm your booking of a tour by paying registration amount. The rest amount can be paid in parts. For details of the partial payment, you may contact a travel advisor at our office.",
      },
      {
        question: "Is the registration amount paid to book the tour refundable?",
        answer:
          "Yes. With certain cancellation charges, the amount is refundable. It varies from tour to tour. Hence you are requested to contact our office for more details.",
      },
      {
        question: "What are the different payment modes available?",
        answer: (
          <div className="space-y-4">
            <p>
              You can make payments for a tour by cheque, demand draft, NEFT,
              RTGS, IMPS, credit card, debit card or UPI gateway. Cheques and
              demand drafts should be drawn in favor of “ANCIENT TRAILS”.
            </p>
            <p>
              In case of payment made by cheque, a booking confirmation will be
              given subject to cheque clearance.
            </p>
          </div>
        ),
      },
      {
        question: "Which documents are required at the time of booking?",
        answer: (
          <div className="space-y-3">
            <p>At the time of booking, a valid identity proof is required:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Domestic tours: Aadhar Card or Voter ID for Indian citizens.</li>
              <li>Foreign tourists: Valid passport.</li>
              <li>International tours: Valid passport.</li>
            </ul>
          </div>
        ),
      },
      {
        question: "Can I book online?",
        answer:
          "As of now there is no facility of booking online. However, you may book over phone or by visiting our office. If booking over phone, you are required to pay the registration amount by any online method to confirm your booking.",
      },
    ],
  },
  {
    title: "Cancellation and Refund FAQ",
    items: [
      {
        question: "What is the cancellation policy of your company?",
        answer:
          "You may refer to our Terms and Conditions page on the website to check the cancellation policy. It is also mentioned in the itineraries of the tours.",
      },
      {
        question: "How long does it take to process the refund?",
        answer:
          "According to policy, once a refund is approved, it will be processed in 7 working days. In certain cases it may take longer depending on the waiver decision from associates, airlines, partners or hotels.",
      },
      {
        question: "What is the mode of payment in case of a refund?",
        answer:
          "Any refund will be directly paid to the traveler by account-payee cheque.",
      },
      {
        question: "In case of medical emergency, what will be the refund policy?",
        answer: (
          <div className="space-y-4">
            <p>
              In case of medical emergency, the refund policy remains the same
              as regular cancellation. Most of the time, amounts utilized to
              book air or train tickets are not refundable or are liable for
              certain cancellation charges. The same amount is to be borne by
              the traveler.
            </p>
            <p>
              If a traveler has made full payment at the time of booking and
              needs to cancel due to medical reasons, then 50% of the total
              booking amount, excluding government taxes, will be refunded.
            </p>
          </div>
        ),
      },
      {
        question: "What will be the refund policy if Ancient Trails cancels the tour?",
        answer:
          "If the tour is cancelled by Ancient Trails, the full amount will be refunded to the traveler within 7 working days from cancellation of the tour. Alternatively, the guest can utilize the same amount for any other future tour.",
      },
    ],
  },
  {
    title: "Hotel Related FAQ",
    items: [
      {
        question: "When will we get hotel confirmation?",
        answer:
          "You will get your hotel details at the time of the pre-tour meeting, which is held 15 days prior to the tour. These confirmations are subject to change depending on availability and unforeseen circumstances such as natural calamities or hotel renovation.",
      },
      {
        question: "Will the Wi-Fi facility be available at the hotel?",
        answer:
          "Most hotels will have complimentary Wi-Fi. However, at certain hotels it may be chargeable, and those charges are to be borne by the traveler. At certain hotels it may not be available at all due to remote locations.",
      },
      {
        question: "Can we get an adjacent or interconnecting room?",
        answer:
          "Such rooms can be arranged in a hotel subject to availability.",
      },
    ],
  },
  {
    title: "Food Related FAQ",
    items: [
      {
        question: "What type of food is served on a tour?",
        answer: (
          <div className="space-y-4">
            <p>
              On a group tour, we serve Indian vegetarian food available at the
              tourist spot. We do not carry a separate cook. Lunch and dinner
              are arranged at hotels or restaurants where food is served in a
              thali system. Breakfast is generally continental with local
              cuisines served by hotels.
            </p>
            <p>
              At certain destinations, we may serve local cuisine to provide
              the flavor of that region.
            </p>
            <p>
              If a traveler wishes to opt for different food such as non-veg,
              continental or Italian, the extra cost is to be borne by the
              traveler.
            </p>
          </div>
        ),
      },
      {
        question: "Is Jain food available on tour?",
        answer:
          "We can arrange Jain food on a traveler’s request. Such intimation is required at the time of booking. At times, under extreme conditions this may not be possible.",
      },
      {
        question: "Should we carry any snacks while on tour?",
        answer:
          "You may carry light snacks with you, but make sure you do not carry too much. Snacks and meals are provided on a tour, so most of the time it is not needed.",
      },
      {
        question: "Can I carry liquor bottles or cigarettes on tour?",
        answer:
          "We strictly follow a No Smoking and No Alcohol policy in a coach or during a group activity. Hence it is not recommended to carry liquor bottles or cigarettes.",
      },
    ],
  },
  {
    title: "Local Transport Related FAQ",
    items: [
      {
        question: "What type of transport will be provided on tour?",
        answer:
          "On most tours, we provide a 2 x 2 AC minibus. On certain tours, depending on group size, AC Tempo Travelers are hired.",
      },
      {
        question: "How is the seating arrangement decided on a tour?",
        answer:
          "Seating arrangement is done on a first-come, first-served basis. A traveler who books earlier will get the front seats. The front two seats are reserved for the tour manager and an expert.",
      },
    ],
  },
];

export default function FaqPage() {
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
            {faqCategories.map((category) => (
              <section key={category.title}>
                <h2 className="font-heading text-[23px] font-bold leading-tight text-secondary sm:text-[30px]">
                  {category.title}
                </h2>
                <Accordion
                  multiple={false}
                  className="mt-5 border-t border-primary/20"
                >
                  {category.items.map((item) => (
                    <AccordionItem
                      key={item.question}
                      value={item.question}
                      className="border-b border-primary/15"
                    >
                      <AccordionTrigger className="min-h-14.5 gap-3 px-1 py-4 font-sans text-[14px] font-semibold leading-snug text-secondary no-underline hover:no-underline sm:gap-4 sm:text-[16px] sm:leading-normal **:data-[slot=accordion-trigger-icon]:hidden">
                        <span>{item.question}</span>
                        <span className="ml-auto grid size-7 shrink-0 place-items-center rounded-full bg-[#fbf0e8] text-primary">
                          <Plus className="size-4 group-aria-expanded/accordion-trigger:hidden" />
                          <Minus className="hidden size-4 group-aria-expanded/accordion-trigger:block" />
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="max-w-3xl px-1 pb-5 text-[14px] leading-[1.8] text-secondary/75 sm:text-[15px]">
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
