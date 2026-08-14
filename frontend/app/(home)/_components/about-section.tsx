"use client";

import Image from "next/image";
import Link from "next/link";
import { Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button, ButtonArrow } from "@/components/ui/button";
import { TextReveal } from "./reveal-on-view";

const aboutVideoSrc = "/home assets/About_banner.mp4";

export function AboutSection() {
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const modalVideoRef = useRef<HTMLVideoElement>(null);
  const closeTimeoutRef = useRef(0);

  const closeVideo = useCallback(() => {
    setIsVideoVisible(false);
    window.clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsVideoOpen(false);
    }, 320);
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(closeTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (!isVideoOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setIsVideoVisible(true);
    });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.cancelAnimationFrame(frameId);
      document.body.style.overflow = previousOverflow;
    };
  }, [isVideoOpen]);

  useEffect(() => {
    if (!isVideoOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeVideo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeVideo, isVideoOpen]);

  const toggleSound = () => {
    setIsMuted((current) => !current);
    void modalVideoRef.current?.play();
  };

  const togglePlayback = () => {
    const video = modalVideoRef.current;

    if (!video) {
      return;
    }

    if (video.paused) {
      void video.play();
      setIsPlaying(true);
      return;
    }

    video.pause();
    setIsPlaying(false);
  };

  const openVideo = () => {
    window.clearTimeout(closeTimeoutRef.current);
    setIsMuted(true);
    setIsPlaying(true);
    setIsVideoVisible(false);
    setIsVideoOpen(true);
  };

  return (
    <section id="about" className="relative bg-background pb-16 pt-4 lg:pb-20">
      <div className="relative h-[320px] overflow-hidden sm:h-[380px]">
        <video
          className="h-full w-full object-cover"
          src={aboutVideoSrc}
          autoPlay
          muted
          loop
          playsInline
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(47,20,5,0.68),rgba(47,20,5,0.72))]" />

        <button
          type="button"
          aria-label="Play Ancient Trails video"
          onClick={openVideo}
          className="group absolute left-1/2 top-[74px] z-10 grid size-[116px] -translate-x-1/2 place-items-center rounded-full border-0 bg-transparent p-0 text-white cursor-pointer"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 120 120"
            className="absolute inset-0 animate-[spin_13s_linear_infinite]"
          >
            <defs>
              <path
                id="about-play-text-path"
                d="M 60, 60 m -45, 0 a 45,45 0 1,1 90,0 a 45,45 0 1,1 -90,0"
              />
            </defs>
            <text className="fill-white text-[11px] font-semibold uppercase tracking-[0.22em]">
              <textPath href="#about-play-text-path">
                Play Video - Play Video - Play Video -
              </textPath>
            </text>
          </svg>
          <span className="grid size-[58px] place-items-center rounded-full bg-white text-secondary shadow-[0_12px_30px_rgba(0,0,0,0.25)] transition-transform duration-[520ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105">
            <Play className="ml-1 size-7 fill-current" strokeWidth={0} />
          </span>
        </button>
      </div>

      <div className="relative z-10 mx-auto -mt-[100px] w-full max-w-[1300px] px-5 sm:px-0">
        <div className="relative overflow-hidden rounded-[12px] border border-primary/15 bg-white p-4 ">
          <div className="relative min-h-[200px] overflow-hidden rounded-[8px]">
            <Image
              src="/home assets/About_trails.webp"
              alt="Ancient Trails leisure heritage"
              fill
              sizes="(min-width: 1024px) 1020px, 100vw"
              className="object-cover"
            />
            <div className="relative z-10 flex min-h-[230px] max-w-[900px] flex-col justify-center px-3 py-8 sm:px-4">
              <TextReveal>
                <p className="text-description font-medium uppercase text-primary">
                  About Ancient Trails
                </p>
              </TextReveal>
              <TextReveal delay={120}>
                <h2 className="mt-2 font-heading text-[34px] font-bold leading-none text-secondary sm:text-[40px] lg:text-title">
                  Learning with Leisure
                </h2>
              </TextReveal>
              <TextReveal delay={240}>
                <p className="mt-6 max-w-[430px] text-description text-secondary">
                  With knowledgeable mentors, tour experts and carefully planned
                  itineraries, we turn rich heritage into an experience you can
                  cherish and learn from.
                </p>
              </TextReveal>
              <div className="mt-7">
                <Button
                  nativeButton={false}
                  render={<Link href="/about" />}
                  className="h-11 w-full min-w-0 justify-between gap-4 px-5 text-[15px] font-normal sm:w-auto sm:gap-6 sm:px-6 sm:text-button lg:min-w-[190px]"
                >
                  Know About Us
                  <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isVideoOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ancient Trails video"
          className={`fixed inset-0 z-50 flex items-center justify-center bg-secondary/80 px-5 py-8 backdrop-blur-sm transition-opacity duration-[520ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isVideoVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <button
            type="button"
            aria-label="Close video"
            onClick={closeVideo}
            className="absolute right-6 top-6 grid size-11 place-items-center rounded-full border border-white/40 bg-white text-secondary transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-primary hover:text-white cursor-pointer"
          >
            <X className="size-6" strokeWidth={2.2} />
          </button>

          <div
            className={`relative w-full max-w-[1040px] origin-center overflow-hidden rounded-[12px] bg-secondary shadow-[0_24px_90px_rgba(0,0,0,0.35)] transition-[opacity,transform,filter] duration-[760ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isVideoVisible
                ? "scale-100 opacity-100 blur-0"
                : "scale-[0.94] opacity-0 blur-[1px]"
            }`}
          >
            <video
              ref={modalVideoRef}
              className="aspect-video w-full bg-secondary object-cover"
              src={aboutVideoSrc}
              autoPlay
              muted={isMuted}
              playsInline
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            <div className="absolute bottom-5 right-5 flex items-center gap-3">
              <button
                type="button"
                aria-label={isPlaying ? "Pause video" : "Play video"}
                onClick={togglePlayback}
                className="grid size-11 place-items-center rounded-full border border-white/40 bg-white/95 text-secondary transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-primary hover:text-white cursor-pointer"
              >
                {isPlaying ? (
                  <Pause className="size-5 fill-current" strokeWidth={0} />
                ) : (
                  <Play className="ml-0.5 size-5 fill-current" strokeWidth={0} />
                )}
              </button>
              <button
                type="button"
                aria-label={isMuted ? "Turn sound on" : "Turn sound off"}
                onClick={toggleSound}
                className="flex h-11 items-center gap-2 rounded-full border border-white/40 bg-white/95 px-5 text-button text-secondary transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-primary hover:text-white cursor-pointer"
              >
                {isMuted ? (
                  <VolumeX className="size-5" strokeWidth={2} />
                ) : (
                  <Volume2 className="size-5" strokeWidth={2} />
                )}
                {isMuted ? "Sound Off" : "Sound On"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
