"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink, Plus, Save, Trash2 } from "lucide-react";
import { AdminDashboardShell } from "@/components/admin-dashboard/admin-dashboard-shell";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { getAdminFaq, updateAdminFaq, type FaqCategory } from "@/lib/faq";
import { cn } from "@/lib/utils";

const fieldClass = "w-full rounded-sm border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";
function move<T>(items: T[], index: number, direction: number): T[] {
  const next = [...items], target = index + direction;
  if (target < 0 || target >= next.length) return items;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
function errorMessage(error: unknown) { return error instanceof Error ? error.message : "Please try again."; }

export default function FaqEditorPage() {
  const toast = useToast();
  const [categories, setCategories] = useState<FaqCategory[] | null>(null);
  const [activeId, setActiveId] = useState("");
  const [savedJson, setSavedJson] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let mounted = true;
    getAdminFaq().then(response => {
      if (!mounted) return;
      const loaded = response.data.faq.categories;
      setCategories(loaded); setSavedJson(JSON.stringify(loaded)); setActiveId(loaded[0]?.id || "");
    }).catch(error => { if (mounted) setLoadError(errorMessage(error)); });
    return () => { mounted = false; };
  }, [reload]);
  const active = categories?.find(category => category.id === activeId);
  const activeIndex = categories?.findIndex(category => category.id === activeId) ?? -1;
  const isDirty = categories !== null && JSON.stringify(categories) !== savedJson;
  const totalFaqs = categories?.reduce((sum, category) => sum + category.items.length, 0) || 0;
  function updateCategory(id: string, update: (category: FaqCategory) => FaqCategory) {
    setCategories(current => current?.map(category => category.id === id ? update(category) : category) || []);
  }
  function addSubject() {
    const id = crypto.randomUUID();
    setCategories(current => [...(current || []), { id, title: "", items: [] }]); setActiveId(id);
  }
  function removeSubject() {
    const next = categories?.filter(category => category.id !== activeId) || [];
    setCategories(next); setActiveId(next[Math.max(0, activeIndex - 1)]?.id || "");
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categories || isSaving || !isDirty) return;
    const form = event.currentTarget;
    const invalid = categories.find(category => !category.title.trim() || category.items.some(item => !item.question.trim() || !item.answer.trim()));
    if (invalid) { form.dataset.adminUnsaved = "true"; setActiveId(invalid.id); toast.error("FAQ details required", "Add a subject, question and answer for each entry before saving."); return; }
    setIsSaving(true);
    try {
      const response = await updateAdminFaq(categories), saved = response.data.faq.categories;
      setCategories(saved); setSavedJson(JSON.stringify(saved));
      delete form.dataset.adminUnsaved;
      toast.success("FAQs saved", "The FAQ page has been updated on the website.");
    } catch (error) { form.dataset.adminUnsaved = "true"; toast.error("Unable to save FAQs", errorMessage(error)); }
    finally { setIsSaving(false); }
  }
  return <AdminDashboardShell activeLabel="Pages">
    <form onSubmit={save} data-admin-unsaved={isDirty ? "true" : undefined} className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div><Link href="/pages" className="mb-3 inline-flex items-center gap-2 text-xs text-foreground/60"><ArrowLeft className="size-4" />Back to Pages</Link>
          <h1 className="text-2xl font-bold">FAQ Page</h1><p className="mt-1 text-sm text-foreground/60">Manage subjects and their questions and answers.</p></div>
        <div className="flex items-center gap-3">
          <a href={(process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "") + "/faq"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><ExternalLink className="size-4" />View FAQ page</a>
          <Button type="submit" disabled={!categories || isSaving || !isDirty} className="rounded-sm"><Save className="size-4" />{isSaving ? "Saving..." : "Save FAQs"}</Button>
        </div>
      </header>
      {loadError ? <div role="alert" className="rounded-sm border border-red-200 bg-white p-5"><p className="text-sm text-red-700">{loadError}</p><Button type="button" variant="outline" className="mt-3" onClick={() => { setLoadError(""); setReload(value => value + 1); }}>Retry</Button></div>
      : !categories ? <p role="status" className="py-10 text-center text-foreground/60">Loading FAQs...</p>
      : <fieldset disabled={isSaving} className="grid min-w-0 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="self-start rounded-sm border border-border bg-white p-4">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Subjects</h2><span className="text-xs text-foreground/50">{categories.length} subjects</span></div>
          <nav aria-label="FAQ subjects" className="space-y-1">
            {categories.map(category => <button key={category.id} type="button" aria-current={category.id === activeId ? "true" : undefined} onClick={() => setActiveId(category.id)} className={cn("flex w-full items-center justify-between gap-3 rounded-sm px-3 py-3 text-left text-sm", category.id === activeId ? "bg-primary/10 font-semibold text-primary" : "text-foreground/75 hover:bg-primary/5")}>
              <span className="min-w-0 break-words">{category.title || "New subject"}</span><span className="shrink-0 text-xs">{category.items.length}</span>
            </button>)}
          </nav>
          <Button type="button" variant="outline" disabled={categories.length >= 30} onClick={addSubject} className="mt-4 w-full rounded-sm"><Plus className="size-4" />Add Subject</Button>
          <p className="mt-3 text-xs leading-relaxed text-foreground/55">{totalFaqs} FAQs in total. Save your changes to update the website. Empty subjects are hidden from visitors.</p>
        </aside>
        {active ? <section className="min-w-0 space-y-4">
          <div className="rounded-sm border border-border bg-white p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">Subject Details</h2><div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" disabled={activeIndex <= 0} aria-label="Move subject up" onClick={() => setCategories(current => move(current || [], activeIndex, -1))}><ArrowUp className="size-4" /></Button>
              <Button type="button" variant="ghost" size="icon" disabled={activeIndex === categories.length - 1} aria-label="Move subject down" onClick={() => setCategories(current => move(current || [], activeIndex, 1))}><ArrowDown className="size-4" /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Remove subject" onClick={removeSubject}><Trash2 className="size-4 text-red-600" /></Button>
            </div></div>
            <label className="block text-xs font-semibold" htmlFor="faq-subject">Subject name</label>
            <input id="faq-subject" value={active.title} required maxLength={120} placeholder="For example, General FAQ" onChange={event => updateCategory(active.id, category => ({ ...category, title: event.target.value }))} className={cn(fieldClass, "mt-2")} />
          </div>
          {active.items.map((item, index) => <section key={item.id} className="rounded-sm border border-border bg-white p-5">
            <div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-bold">FAQ {index + 1}</h3><div className="flex gap-1">
              <Button type="button" variant="ghost" size="icon" disabled={index === 0} aria-label={"Move FAQ " + (index + 1) + " up"} onClick={() => updateCategory(active.id, category => ({ ...category, items: move(category.items, index, -1) }))}><ArrowUp className="size-4" /></Button>
              <Button type="button" variant="ghost" size="icon" disabled={index === active.items.length - 1} aria-label={"Move FAQ " + (index + 1) + " down"} onClick={() => updateCategory(active.id, category => ({ ...category, items: move(category.items, index, 1) }))}><ArrowDown className="size-4" /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label={"Remove FAQ " + (index + 1)} onClick={() => updateCategory(active.id, category => ({ ...category, items: category.items.filter(entry => entry.id !== item.id) }))}><Trash2 className="size-4 text-red-600" /></Button>
            </div></div>
            <label htmlFor={item.id + "-question"} className="block text-xs font-semibold">Question</label>
            <input id={item.id + "-question"} required maxLength={500} value={item.question} className={cn(fieldClass, "mt-2")} onChange={event => updateCategory(active.id, category => ({ ...category, items: category.items.map(entry => entry.id === item.id ? { ...entry, question: event.target.value } : entry) }))} />
            <label htmlFor={item.id + "-answer"} className="mt-4 block text-xs font-semibold">Answer</label>
            <textarea id={item.id + "-answer"} required maxLength={8000} rows={5} value={item.answer} className={cn(fieldClass, "mt-2 resize-y leading-relaxed")} onChange={event => updateCategory(active.id, category => ({ ...category, items: category.items.map(entry => entry.id === item.id ? { ...entry, answer: event.target.value } : entry) }))} />
            <p className="mt-2 text-xs text-foreground/50">Use line breaks for paragraphs or lists.</p>
          </section>)}
          {!active.items.length ? <p className="rounded-sm border border-dashed border-border p-6 text-sm text-foreground/60">No FAQs in this subject yet. Add a question and answer below.</p> : null}
          <Button type="button" variant="outline" disabled={active.items.length >= 100 || totalFaqs >= 500} onClick={() => updateCategory(active.id, category => ({ ...category, items: [...category.items, { id: crypto.randomUUID(), question: "", answer: "" }] }))} className="rounded-sm"><Plus className="size-4" />Add FAQ</Button>
        </section> : <div className="rounded-sm border border-dashed border-border bg-white p-8 text-sm text-foreground/60">Add a subject to start creating FAQs.</div>}
      </fieldset>}
    </form>
  </AdminDashboardShell>;
}
