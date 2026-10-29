import Image from "next/image";
import {
  Bike, Camera, Globe2, Palette, PersonStanding,
  UsersRound, type LucideIcon,
} from "lucide-react";

import { Header } from "@/components/layout/header";
import { ButtonArrow } from "@/components/ui/button";
import { SpecialisedTourEnquiryButton } from "@/components/contact/specialised-tour-enquiry";
import styles from "./specialised-tour-page.module.css";

const actionButtonClassName = "h-auto min-h-11 w-full min-w-0 justify-between gap-4 whitespace-normal px-5 py-2 text-left font-normal sm:w-auto sm:gap-8 sm:px-6 lg:h-11 lg:whitespace-nowrap lg:py-0";
const buttonArrowClassName = "brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0";

type SpecialisedInterest = {
  id: string;
  audience: string;
  description: string;
  button: string;
  search: string;
  icon: LucideIcon;
  illustration: string;
  alt: string;
  inlineHeading?: boolean;
};

const interests: SpecialisedInterest[] = [
  {
    id: "photographers", audience: "Photographers",
    description: "This tour is dedicated to a photographer hidden in you. No matter whether you are Novice, Apprentice or Expert, this tour focuses on some hands-on heritage photography with an expert in the industry. A unique confluence of understanding history along with capturing it in your frame.",
    button: "Explore Photographer Tours", search: "photograph", icon: Camera, illustration: "hero-sketch",
    alt: "A photographer capturing the ancient temples of Hampi at sunset",
  },
  {
    id: "dancers", audience: "Dancers",
    description: "Indian Classical Dance has spread its roots deeply in our rich culture and heritage. It may be of any type whether Bharatnatyam, Kathak, Odissi, or Kuchipudi. Every ancient monument displays this dance culture in its unique way. We have crafted this tour exclusively for the dancers to get the essence of the philosophy, iconography and the roots of different dance poses.",
    button: "Explore Dancer Tours", search: "dance", icon: PersonStanding, illustration: "dancer-sketch",
    alt: "A classical Indian dancer performing among intricately carved temple pillars",
  },
  {
    id: "artists", audience: "Artists",
    description: "Heritage monuments have always been a centre of attraction for every artist. These monuments look enigmatic and hold an ocean of tales inside them. Putting the exact emotions on canvas is truly challenging. This tour is specially designed keeping all the needs of an artist in mind. A true golden opportunity for artists, where they get to witness the grand monuments and an ample amount of time to draw them on their canvas under the guidance of a subject expert.",
    button: "Explore Artist Tours", search: "artist", icon: Palette, illustration: "artist-sketch",
    alt: "An artist painting the golden stone temples of Hampi on an outdoor easel",
  },
  {
    id: "bikers", audience: "Biker’s",
    description: "Who told that temples and historic monuments are boring and only meant for elders! Riding through the lush green surroundings of Hampi or ‘Belur and Coorg’ and many more likewise destinations are only meant for enthusiastic and rugged riders. If you are one of those then this tour is designed only for you. An experienced bike rider, that too with the knowledge of history will accompany you on this tour. It is an exclusive combination of fun with some knowledge of our Rich Heritage.",
    button: "Explore Biker Tours", search: "biker", icon: Bike, illustration: "biker-sketch",
    alt: "Motorcyclists exploring a winding road through the temples and boulders of Hampi",
  },
  {
    id: "kids", audience: "Kids",
    description: "Today, knowing and understanding Indian Heritage and Culture is mostly needed for kids. History has been the most ignored topic in schools. Moreover, history has always been a victim of miscommunication and misinterpretation. Our rich history is the prime source of inspiration for a new generation to create a new history. Hence we have come up with Heritage tours for kids that are going to be fun-filled and equally learning.",
    button: "Explore Kids Tours", search: "kids", icon: UsersRound, illustration: "kids-sketch",
    alt: "School children learning about carved temple sculptures with a heritage guide", inlineHeading: true,
  },
  {
    id: "foreigners", audience: "Foreigners & NRI’s",
    description: "Ancient Trails has crafted exclusive Heritage tours for foreigners & NRI’s, understanding their needs. Our expert Indologist/Archaeologist will accompany every tour ensuring our guests are provided the most authentic information on Indian Heritage and Culture.",
    button: "Explore Foreigners & NRI’s Tours", search: "foreign", icon: Globe2, illustration: "traveller-sketch",
    alt: "International travellers discovering Hampi’s stone temple carvings with a local guide", inlineHeading: true,
  },
];

function InterestRow({ interest, index }: { interest: SpecialisedInterest; index: number }) {
  const Icon = interest.icon;
  return (
    <article id={interest.id} className={`${styles.interestRow} ${index % 2 ? styles.reverse : ""}`}>
      <div className={styles.photo}>
        <Image src={`/specialised-tours/${interest.id}.webp`} alt={interest.alt} fill
          priority={index === 0} sizes="(max-width: 699px) 90vw, (max-width: 1500px) 46vw, 650px" className={styles.photoImage} />
        <span className={styles.iconBadge} aria-hidden="true"><Icon strokeWidth={1.7} /></span>
      </div>
      <div className={styles.copy}>
        <div className={styles.decoration} aria-hidden="true">
          <Image src={`/specialised-tours/${interest.illustration}.webp`} alt="" fill sizes="250px" className={styles.sketch} />
        </div>
        <h2 className={`${styles.interestHeading} ${interest.inlineHeading ? styles.inlineHeading : ""}`}>
          {interest.id === "bikers" ? <><span>{interest.audience}</span> Heritage</> : <>
            <span className={styles.headingPrefix}>Heritage for {!interest.inlineHeading && <i aria-hidden="true" />}</span>{" "}
            <span className={styles.audience}>{interest.audience}</span>
            {interest.id === "kids" && <i aria-hidden="true" />}
          </>}
        </h2>
        <p className={styles.description}>{interest.description}</p>
        <SpecialisedTourEnquiryButton category={interest.id} className={`${styles.action} ${actionButtonClassName}`}>
          {interest.button}<ButtonArrow className={buttonArrowClassName} />
        </SpecialisedTourEnquiryButton>
      </div>
    </article>
  );
}

export function SpecialisedTourPage() {
  return (
    <main id="main-content" tabIndex={-1} className={styles.page}>
      <div className="home-wide-frame mx-auto w-full px-5 sm:px-0"><Header /></div>
      <div className="home-wide-frame mx-auto w-full px-5 sm:px-8 [@media(min-width:1300px)]:px-12">
        <section className={styles.intro} aria-labelledby="specialised-tours-heading">
          <div className={styles.introCopy}>
            <p className={styles.eyebrow}>Specialised Tours <span aria-hidden="true" /></p>
            <h1 id="specialised-tours-heading">Unique Journeys for<br />Every Passion</h1>
            <p className={styles.introDescription}>Our specialised tours are thoughtfully curated for travellers with unique interests. Whether you are a photographer, dancer, artist, biker, young explorer or an international guest, these tours offer meaningful experiences designed to match your passion.</p>
          </div>
          <div className={styles.introIllustration} aria-hidden="true">
            <Image src="/specialised-tours/hero-sketch.webp" alt="" fill priority sizes="(max-width: 699px) 0px, 45vw" />
          </div>
        </section>
        <section className={styles.interests} aria-label="Specialised tours by interest">
          {interests.map((interest, index) => <InterestRow key={interest.id} interest={interest} index={index} />)}
        </section>
      </div>
      <section className={`home-wide-frame ${styles.contactBanner}`} aria-labelledby="plan-specialised-tour">
        <Image src="/home assets/Briddeshwara temple_banner.webp" alt="" fill sizes="95vw" className={styles.contactImage} />
        <div className={styles.contactIllustration} aria-hidden="true"><Image src="/illustration/Hampi illustration.png" alt="" fill sizes="240px" /></div>
        <div className={styles.contactCopy}>
          <p className={styles.eyebrow}><span aria-hidden="true" /> Ready to Explore?</p>
          <h2 id="plan-specialised-tour">Let’s Plan Your<br />Specialised Tour</h2>
          <p>Get in touch with our team to customise a tour<br className={styles.desktopBreak} /> that matches your passion and interests.</p>
        </div>
        <SpecialisedTourEnquiryButton className={`${styles.action} ${styles.contactAction} ${actionButtonClassName}`}>
          Contact Us <ButtonArrow className={buttonArrowClassName} />
        </SpecialisedTourEnquiryButton>
      </section>
    </main>
  );
}
