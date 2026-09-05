import { Header } from "@/components/layout/header";

export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-325 px-5 py-4 sm:px-6 lg:px-0">
        <Header />
      </div>

      <main className="border-t border-primary/10">
        <div className="mx-auto w-full max-w-275 px-5 py-12 sm:px-8 lg:py-16">
          <h1 className="font-heading text-[32px] font-bold leading-tight text-secondary sm:text-[46px] sm:leading-none">
            Terms and Conditions
          </h1>

          <p className="mt-4 text-[14px] text-secondary/60">
            Last updated: 31 May 2020
          </p>

          <div className="mt-10 space-y-9 text-[14px] leading-[1.8] text-secondary/75 sm:text-[15px]">
            <div className="space-y-4">
              <p>
                Thank you for choosing Ancient Trails for the best heritage
                experience. We put in all the efforts to ensure your travelling
                experience is filled with knowledge and leisure. Please read
                these Terms and Conditions carefully to avoid any
                misunderstanding and enjoy your tour.
              </p>
              <p>
                These Terms and Conditions apply to all domestic and
                international tours and customized holidays organized by
                Ancient Trails. By using our website, you confirm your
                agreement to these terms and undertake to comply with them. If
                you disagree with them, you may stop using our website.
              </p>
            </div>

            <Section title="Definitions">
              <p>
                In these Terms and Conditions, the following terms have the
                meanings specified below unless the context requires otherwise.
              </p>
              <DefinitionList
                items={[
                  ["The Company", "Ancient Trails, also referred to as we, us or our."],
                  ["Guest", "Traveler, Customer, Client, You or Your means the person in whose name or on whose behalf a booking, enquiry or related service is made."],
                  ["Infant and Child", "An infant is a child below two years of age. A child is above two and below twelve years of age."],
                  ["Tour or Trail", "Any domestic or international tour organized by Ancient Trails."],
                  ["Customized holiday", "A tailor-made holiday whose itinerary is designed according to the individual requirements of a guest."],
                  ["Corporate tours (MICE)", "Specialized group tourism for meetings, incentives, conferences, exhibitions, seminars and other events at heritage destinations."],
                  ["Contractor, Supplier or Vendor", "A provider of infrastructure or travel services, including hotels, airlines, caterers, restaurants, museums, art galleries, cruises and coaches in India or abroad."],
                  ["Tour price or cost", "The price shown in the price grid, brochure or online, together with applicable taxes, surcharges and other payments payable by the client."],
                  ["Tour Manager", "A person designated by the Company to help, lead or guide a tour in or outside India."],
                  ["Expert", "An Indology or subject expert who shares knowledge about heritage places. An Expert does not lead or manage the tour and is not responsible for management-related queries."],
                  ["Day", "A part of a day, twenty-four hours or any part thereof as referred to in a tour."],
                  ["All meals", "Breakfast, lunch and dinner."],
                  ["Unforeseen circumstances", "Circumstances outside Ancient Trails' reasonable control, including war, rebellion, epidemic, explosion, fire, flood, earthquake, acts of God, riots, government action, legal changes, strikes, abnormal weather or sea conditions, closure of sightseeing places, transport strikes, curfews and city shutdowns."],
                  ["Website and webpage", "The website ancient-trails.com and pages available on that website."],
                  ["GST", "Goods and Services Tax."],
                  ["Cancellation Policy", "The cancellation charges levied by the Company and third parties from time to time, as described here or in another applicable document."],
                ]}
              />
              <p>
                These Terms and Conditions include the rules relating to
                booking a tour, booking forms, the website, itinerary, tour
                cost, payment schedule, cancellation, customer data and
                promotions. Each term is severable. If a provision is declared
                invalid, illegal or unenforceable, the remaining provisions
                will continue in full force and effect.
              </p>
            </Section>

            <Section title="Booking Terms">
              <Subsection title="Registration for the tour">
                <p>
                  Registering for a tour online or offline by paying a
                  registration amount indicates that the guest has read and
                  accepted all terms and conditions on the Ancient Trails
                  website, booking form and brochure. A guest completing
                  booking formalities for family members is deemed authorized
                  to do so after they have read these terms.
                </p>
                <p>
                  Office bookings require a completed and signed booking form,
                  acceptance of these Terms and Conditions and payment by cash,
                  cheque, demand draft, card, NEFT, RTGS, IMPS or UPI. Cheque
                  and NEFT bookings are confirmed after realization of funds.
                  After successful confirmation, a contract is formed between
                  Ancient Trails and the guest.
                </p>
              </Subsection>

              <Subsection title="Documents for booking a tour">
                <p>
                  Guests must provide valid photo identification for domestic
                  tours and a passport with at least six months validity from
                  arrival in another country. PAN submission is mandatory for
                  international tours. Other required documents may include:
                </p>
                <BulletList
                  items={[
                    "Address proof such as an Aadhaar Card, Voter's ID or Driving Licence.",
                    "PAN card for international tours.",
                    "A physically signed booking form for offline bookings.",
                    "A physically signed Terms and Conditions form for offline bookings.",
                  ]}
                />
              </Subsection>

              <Subsection title="Online booking">
                <p>
                  A guest may book a tour through ancient-trails.com. Required
                  documents must be sent by email or delivered to our office.
                  Online acceptance of the Privacy Policy and these Terms and
                  Conditions forms a valid and legally binding contract.
                </p>
                <p>
                  Our booking engine may malfunction because of software or
                  network errors. Payment details may be handled by a third-
                  party bank or payment gateway, and Ancient Trails is not
                  responsible for their storage or practices. Online bookings
                  are subject to availability and the discretion of Ancient
                  Trails. Incorrect contact details may result in cancellation
                  at the guest&apos;s risk and cost.
                </p>
              </Subsection>

              <Subsection title="Physical fitness">
                <p>
                  Booking a tour confirms that the guest is physically fit to
                  travel to the destination. Guests must inform Ancient Trails
                  in writing of any medical condition that may affect their
                  ability to enjoy the tour. Health issues, hospitalization,
                  stay-back costs and medication are the guest&apos;s responsibility.
                  Service providers may refuse travel on medical grounds.
                </p>
                <p>
                  Guests are encouraged to obtain suitable travel insurance and
                  should read the insurance terms carefully. Ancient Trails may
                  request medical tests or written fitness certification before
                  departure or during a tour where reasonably necessary.
                </p>
              </Subsection>
            </Section>

            <Section title="Amendment and Cancellation of a Booking">
              <Subsection title="Amendment in booking">
                <p>
                  Amendment requests must be made in writing or by email and
                  are subject to availability. An amended booking is not a new
                  booking. Amendment charges of INR 1,000 plus GST apply for
                  every amendment.
                </p>
              </Subsection>

              <Subsection title="Cancellation of booking">
                <p>
                  Cancellation requests must be submitted in writing together
                  with the original receipts or invoices. The following charges
                  apply per person:
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-105 border-collapse text-left">
                    <thead>
                      <tr className="border-b border-primary/20 text-secondary">
                        <th className="px-3 py-3 font-semibold">Days before departure</th>
                        <th className="px-3 py-3 font-semibold">Cancellation charge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["0-10", "100%"],
                        ["10-20", "50%"],
                        ["20-30", "30%"],
                        ["30 and above", "10%"],
                      ].map(([period, charge]) => (
                        <tr key={period} className="border-b border-primary/10">
                          <td className="px-3 py-3">{period}</td>
                          <td className="px-3 py-3">{charge}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <NumberedList
                  items={[
                    "Non-refundable airfare and applicable airline charges will be borne by the customer. Refunds, where applicable, will be paid by cheque within seven working days after receipt of the cancellation request.",
                    "Cancellation charges exclude GST. GST charged on tours is non-refundable.",
                    "Insurance claims must be made directly with the insurance company according to its policy.",
                    "Visa rejection, or failure to receive visa information from the consulate, may be treated as a deemed cancellation and the applicable charges will apply.",
                    "Non-payment of the remaining tour cost will be treated as cancellation from the date communicated by Ancient Trails. The guest must make payments by the stated deadline.",
                    "No-show on the first day of a tour is deemed cancellation and no refund is applicable.",
                    "Discontinuing or terminating an ongoing tour is deemed cancellation and no refund is applicable.",
                  ]}
                />
              </Subsection>

              <Subsection title="Tour cancellation by Ancient Trails">
                <p>
                  Ancient Trails may cancel or reschedule a tour. Notice will
                  be given to the guest, and amounts paid will be refunded by
                  account-payee cheque within seven working days. Ancient Trails
                  is not liable for interest. A guest may instead choose to use
                  the amount for a future tour by contacting our office.
                </p>
              </Subsection>
            </Section>

            <Section title="Hotels and Meals">
              <Subsection title="Hotels">
                <NumberedList
                  items={[
                    "Ancient Trails selects the most convenient and comfortable hotels available. At heritage destinations, comparable hotels may have limited availability, and no liability is accepted for variation in standard or location.",
                    "Damage to hotel rooms, coaches or places of visit is payable by the guest. Pre-existing damage should be reported immediately. Ancient Trails is not responsible for disruptions to telephone, internet or other amenities, or for hotel staff behavior outside its control.",
                    "Mini bars, alcohol, laundry, paid television, telephone calls and other chargeable facilities are not included in the tour cost.",
                    "Wi-Fi may be unavailable at remote locations or may carry an additional charge payable by the guest.",
                  ]}
                />
                <p className="font-semibold text-secondary">Occupancy and room allocation</p>
                <Subsection title="Single occupancy">
                  <p>
                    Single occupancy is available at an additional charge for
                    the entire tour. Single rooms may be smaller or located
                    separately from twin-sharing rooms.
                  </p>
                </Subsection>
                <Subsection title="Twin, double and triple occupancy">
                  <p>
                    Tours are generally based on twin sharing. Separate beds,
                    queen beds and triple sharing are subject to availability.
                    A third bed may be a mattress or cot. Guests joining alone
                    may be assigned a same-gender sharing partner, subject to
                    availability. Room partners are responsible for settling
                    issues between themselves, and Ancient Trails is not liable
                    for loss or mishap arising from shared rooms.
                  </p>
                </Subsection>
                <p>
                  Adjoining, interconnecting, non-smoking, same-floor and
                  ground-floor rooms cannot be guaranteed. Guests must follow
                  hotel check-in and check-out times and pay any charges for
                  early check-in or late check-out. Children booked without a
                  bed will not receive a hotel bed, and extra services for
                  children are payable directly to the hotel.
                </p>
              </Subsection>

              <Subsection title="Meals">
                <p>
                  Meals generally follow a preset menu and are mostly
                  vegetarian. Ancient Trails may change meal arrangements when
                  necessary. Missed meals or breakfast due to lateness, delays
                  or other reasons are not refundable.
                </p>
                <p>
                  Special meal requirements and allergies must be communicated
                  at booking and are handled on a request basis only. Jain food,
                  infant food and other special arrangements cannot be
                  guaranteed. Restaurant seating, sanitation and service are
                  controlled by independent restaurants.
                </p>
              </Subsection>
            </Section>

            <Section title="Local Transport, Airlines and Baggage">
              <Subsection title="Local transport">
                <NumberedList
                  items={[
                    "Transport may be a 2 x 2 air-conditioned coach or an air-conditioned tempo traveller depending on group size.",
                    "Seating is normally allocated according to booking date, although guests are encouraged to offer front seats to elders. The Tour Manager will resolve seating issues.",
                    "The first two bus seats are reserved for the Tour Manager and Expert.",
                    "Ancient Trails is not responsible for defects in buses or driver behavior. Guests must not give independent instructions to drivers.",
                    "Smoking and alcohol are prohibited on coaches. Guests must keep valuables with them and are responsible for damage caused to the vehicle.",
                  ]}
                />
              </Subsection>

              <Subsection title="Airlines">
                <NumberedList
                  items={[
                    "Flights included in an itinerary are subject to the applicable airline agreement.",
                    "Tickets are generally booked in a group and sent to guests by email.",
                    "Names must match passports or identity documents. Ancient Trails is not liable for name-change fees or denial of boarding due to mismatch.",
                    "Airline prices, routes and schedules are controlled by the airline. Any increase or change is the guest's responsibility.",
                    "Last-minute airfare differences, class upgrades, special seats and additional airline services are payable by the guest.",
                    "Guests who skip included air travel must join at the specified place and time. The tour will not be held for a delayed or absent guest.",
                    "Airfare refunds and cancellations are governed by the airline policy.",
                    "Ancient Trails may offer alternative schedules when airlines change their schedules and is not responsible for airline delays, cancellations, routing changes, overbooking, baggage loss or service quality.",
                  ]}
                />
              </Subsection>

              <Subsection title="Additional charges and baggage">
                <p>
                  Airline, fuel, visa, VFS, airport development and government
                  tax increases are outside Ancient Trails&apos; control and must be
                  paid by the guest. Airline ticket changes and cancellations
                  are governed by the relevant airline terms.
                </p>
                <p>
                  Baggage allowances, dimensions and fees vary by airline and
                  class. Guests must check the current airline policy and pay
                  excess baggage charges. Porterage is not included in the tour
                  cost.
                </p>
              </Subsection>
            </Section>

            <Section title="General Terms">
              <Subsection title="Complimentary items and expert availability">
                <p>
                  Complimentary items, services and activities are at the sole
                  discretion of management and may be amended or discontinued
                  without notice. If an outside Expert is unavailable, Ancient
                  Trails may arrange an in-house Expert.
                </p>
              </Subsection>
              <Subsection title="Money to carry on a tour">
                <p>
                  Guests should carry sufficient money for personal expenses and
                  medical emergencies. For international tours, a maximum of
                  USD 3,000 may be carried in cash at a time; the balance may be
                  carried on a Forex Card. Currency rates and international tour
                  costs may change with exchange-rate fluctuations.
                </p>
              </Subsection>
              <Subsection title="Participation and special assistance">
                <p>
                  Guests under eighteen must be accompanied by an adult. Guests
                  must disclose physical, medical or other special needs at
                  booking and must be medically and physically able to travel.
                  Ancient Trails may exclude a guest whose participation risks
                  the health or safety of others.
                </p>
                <p>
                  Ancient Trails does not employ medical personnel. Medical care
                  and related costs are the guest&apos;s responsibility. Tours may
                  include rough terrain, extensive walking, uneven pavement,
                  stairs and demanding outdoor activities. Guests should assess
                  their ability and insurance before participating.
                </p>
              </Subsection>
              <Subsection title="Tour Managers and communication">
                <p>
                  Tour Managers assist guests but are not responsible for
                  baggage, loss, damage, injury or personal belongings. Guests
                  must follow tour instructions and remain responsible for
                  their own conduct. A temporary WhatsApp group may be created
                  on the second day for tour information; guests may opt out by
                  informing the Tour Manager.
                </p>
              </Subsection>
              <Subsection title="Guest behavior and punctuality">
                <p>
                  Guests must behave respectfully and avoid abusive, aggressive,
                  disruptive or illegal conduct. Ancient Trails may refuse or
                  terminate arrangements for behavior that endangers, upsets or
                  causes distress to others. Full cancellation charges may apply
                  without refund. Guests are responsible for valuables, damaged
                  property and any resulting claims or costs.
                </p>
              </Subsection>
              <Subsection title="Risk and safety">
                <p>
                  Tours may involve risks associated with transportation,
                  undeveloped areas, nature, political unrest, lawlessness,
                  sanitation, food, insects, animals, illness and limited
                  emergency facilities. By booking, guests voluntarily accept
                  these risks and agree not to make claims against Ancient
                  Trails for bodily injury, emotional trauma, death, property
                  loss or related expenses to the extent permitted by law. This
                  agreement binds guests, family members, heirs and legal
                  representatives.
                </p>
              </Subsection>
            </Section>

            <Section title="Liabilities and Responsibilities">
              <Subsection title="Liability of Ancient Trails">
                <p>
                  Ancient Trails&apos; liability is limited to making reservations in
                  accordance with the guest&apos;s requirements. The Company is not
                  liable for loss or damage caused by independent contractors.
                  A courtesy extended to minimize loss is not an admission of
                  liability or waiver.
                </p>
                <p>
                  If a booking is confirmed at an erroneous price, Ancient
                  Trails may correct the error by notifying the guest. Unless
                  the erroneous price is honored, the guest may cancel within
                  seven days of notification without penalty.
                </p>
              </Subsection>
              <Subsection title="Guest responsibility">
                <p>
                  Guests must provide accurate, current and complete booking
                  information. Travel documents are non-transferable and must
                  match the passport or identity holder. Guests must maintain
                  copies of passports, visas, tickets, insurance and other
                  statutory documents and collect them in time for departure.
                </p>
              </Subsection>
              <Subsection title="Extra information">
                <BulletList
                  items={[
                    "For part tours, the Tour Manager may not accompany guests at arrival or departure.",
                    "NRIs and foreign guests must follow Indian and local government rules and carry required documents, including an OCI Card where applicable.",
                    "External guests may not be invited to or use tour services.",
                    "Paid toilets may be present at some destinations.",
                    "Coaches and many hotels, restaurants, trains and cruises are smoke-free, and alcohol is prohibited on coaches.",
                    "Claims about independent contractors must be reported in writing immediately and no later than seven days.",
                    "Communications sent to the contact details provided in the booking form are deemed received.",
                    "Guests agree that photographs and video clips taken on tour or supplied by them may be used for Ancient Trails' business promotion without further payment.",
                    "Maps on tour pages are indicative and for reference only.",
                    "Guests agree to indemnify Ancient Trails against third-party claims arising from their participation in a tour.",
                    "Disputes are subject to the courts of Pune, India. An unsuccessful legal claimant agrees to pay applicable legal costs, including attorney or client fees.",
                  ]}
                />
              </Subsection>
            </Section>

            <Section title="Website Terms">
              <Subsection title="Accessing our website">
                <p>
                  The website may be unavailable, suspended, withdrawn or
                  changed without notice for maintenance, upgrades, repairs,
                  security or other reasons. Ancient Trails has no liability if
                  the website is unavailable.
                </p>
              </Subsection>
              <Subsection title="No misuse">
                <p>
                  Guests must not introduce malicious software, gain
                  unauthorized access, or attack the website or its servers.
                  Breaches may be reported to law enforcement and will end the
                  right to use the website.
                </p>
              </Subsection>
              <Subsection title="Accuracy and third-party websites">
                <p>
                  Website content is general information and is used at the
                  visitor&apos;s own risk. Guests are responsible for the accuracy of
                  information submitted to Ancient Trails. Ancient Trails is
                  not responsible for third-party products, websites, content,
                  quality, safety or consequences of visiting external links.
                </p>
              </Subsection>
              <Subsection title="Validity, viruses and copyright">
                <p>
                  Website content may change and is not guaranteed to be
                  accurate, complete or current. Visitors should use suitable
                  protective software before downloading content. Copyright,
                  designs, database rights, trademarks, patents and other
                  intellectual property in the website remain the property of
                  Ancient Trails. Copying website content may result in legal
                  action.
                </p>
              </Subsection>
            </Section>

            <Section title="Disclaimer and Changes">
              <p>
                By booking a tour, the guest forms a contract with Ancient
                Trails and confirms that these Terms and Conditions have been
                read and accepted. We may revise these terms from time to time
                without prior notice. The latest version published on the
                website overrides all previously published versions.
              </p>
            </Section>

            <Section title="Contact Us">
              <p>
                Questions, complaints or enquiries about these Terms and
                Conditions may be sent to{" "}
                <a
                  href="mailto:travelwith@ancient-trails.com"
                  className="font-medium text-primary"
                >
                  travelwith@ancient-trails.com
                </a>
                .
              </p>
              <p>
                Contact numbers:  +91 7272 90 0202, +91 7272 90 0606 and 020
                24441323.
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

function Subsection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-secondary">{title}</h3>
      {children}
    </div>
  );
}

function DefinitionList({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="space-y-3">
      {items.map(([term, definition]) => (
        <div key={term}>
          <dt className="inline font-semibold text-secondary">{term}: </dt>
          <dd className="inline">{definition}</dd>
        </div>
      ))}
    </dl>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-6">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <ol className="list-decimal space-y-2 pl-6">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ol>
  );
}
