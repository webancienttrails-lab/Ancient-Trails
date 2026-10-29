import { getPublicFaq } from "@/lib/faq";
import { JsonLd } from "@/components/seo/json-ld";
import { faqStructuredData } from "@/lib/structured-data";
import { FaqPageContent } from "./_components/faq-page-content";

export default async function FaqPage() {
  const response = await getPublicFaq().catch(() => null);
  const categories = response ? response.data.faq.categories.filter(category => category.items.length > 0) : null;
  return <>
    <JsonLd id="faq-jsonld" data={faqStructuredData(categories ?? [])} />
    <FaqPageContent initialCategories={categories} />
  </>;
}
