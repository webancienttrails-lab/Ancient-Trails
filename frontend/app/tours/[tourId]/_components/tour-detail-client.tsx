"use client";

import dynamic from "next/dynamic";

const SingleTourPage = dynamic(
  () => import("./single-tour-page").then((module) => module.SingleTourPage),
  {
    ssr: false,
    loading: () => (
      <main className="grid min-h-screen place-items-center bg-background px-4 text-center text-secondary">
        <div>
          <span className="mx-auto block size-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <p className="mt-4 font-sans text-[15px] font-semibold">
            Loading tour details...
          </p>
        </div>
      </main>
    ),
  }
);

export function TourDetailClient({ tourId }: { tourId: string }) {
  return <SingleTourPage tourId={tourId} />;
}
