"use client";

import Image from "next/image";
import { User } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

const navItems = [
  "Home",
  "About",
  "Tours",
  "Destinations",
  "Experiences",
  "Tour Calendar",
];

export function Header() {
  const activeItem = "Home";
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [underlineStyle, setUnderlineStyle] = useState({
    opacity: 0,
    transform: "translate3d(0, 0, 0)",
  });
  const navRef = useRef<HTMLUListElement>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  const updateUnderline = useCallback(() => {
    const nav = navRef.current;
    const currentItem = hoveredItem ?? activeItem;
    const link = linkRefs.current[currentItem];

    if (!nav || !link) {
      return;
    }

    const navRect = nav.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    const underlineWidth = 57;
    const left = linkRect.left - navRect.left + linkRect.width / 2 - underlineWidth / 2;

    setUnderlineStyle({
      opacity: 1,
      transform: `translate3d(${left}px, 0, 0)`,
    });
  }, [hoveredItem]);

  useLayoutEffect(() => {
    updateUnderline();

    window.addEventListener("resize", updateUnderline);

    return () => {
      window.removeEventListener("resize", updateUnderline);
    };
  }, [updateUnderline]);

  return (
    <header className="flex items-center justify-between rounded-[18px] bg-white/95 px-5 py-3  backdrop-blur md:px-6">
      <a href="#" aria-label="Ancient Trails home" className="shrink-0">
        <Image
          src="/Header Logo.png"
          alt="Ancient Trails"
          width={218}
          height={86}
          priority
          className="h-13 w-auto"
        />
      </a>

      <nav aria-label="Primary navigation" className="hidden lg:block">
        <ul
          ref={navRef}
          onMouseLeave={() => setHoveredItem(null)}
          className="relative flex items-center gap-8 text-header font-medium text-accent"
        >
          {navItems.map((item) => (
            <li key={item}>
              <a
                href="#"
                ref={(node) => {
                  linkRefs.current[item] = node;
                }}
                onMouseEnter={() => setHoveredItem(item)}
                className={`relative transition-colors hover:text-primary ${
                  item === "Home" ? "text-primary" : ""
                }`}
              >
                {item}
              </a>
            </li>
          ))}
          <Image
            src="/Path 5647.png"
            alt=""
            width={57}
            height={3}
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-3 left-0 h-[3px] w-[57px] transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={underlineStyle}
          />
        </ul>
      </nav>

      <a
        href="#"
        className="flex items-center gap-2 text-header font-medium text-accent transition-colors hover:text-primary"
      >
        Login
        <User className="size-4 fill-primary text-primary" strokeWidth={2.3} />
      </a>
    </header>
  );
}
