import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function TravelEmptyState({ experiences = false }: { experiences?: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-primary/25 bg-white/75 px-5 py-10 text-center">
      <h3 className="font-heading text-2xl font-semibold text-secondary">
        {experiences ? "No experiences here yet." : "No tours here yet."}
      </h3>
      <Link href="/contact#enquiry-form" className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-sans text-sm font-medium text-white transition-opacity hover:opacity-90">
        Tell us what you want <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
