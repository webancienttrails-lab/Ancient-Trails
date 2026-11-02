"use client";

import { useState } from "react";
import { isGoogleMapsUrl } from "@/lib/destination-map";
import type { DestinationPageContent } from "@/lib/destination-page-content";
import { getDestinationMediaUrl, uploadDestinationImages } from "@/lib/destinations";

type TextKey = Exclude<keyof DestinationPageContent, "thingsToKnow" | "quickFacts" | "seasons" | "attractions" | "mapHighlights">;
const inputClass = "w-full rounded-sm border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary disabled:bg-muted/35 read-only:bg-muted/35";

export function DestinationPageContentEditor({ value = {}, readOnly, disabled, onChange, onUploadStateChange }: {
  value?: DestinationPageContent; readOnly: boolean; disabled: boolean;
  onChange: (content: DestinationPageContent) => void;
  onUploadStateChange: (uploading: boolean) => void;
}) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState("");
  function update<K extends keyof DestinationPageContent>(key: K, next: DestinationPageContent[K]) { onChange({ ...value, [key]: next }); }
  const field = (key: TextKey, label: string, multiline = false) => <label key={key} className="grid content-start gap-2 text-xs font-semibold text-foreground/70">
    {label}
    {multiline ? <textarea rows={3} readOnly={readOnly} value={value[key] || ""} onChange={event => update(key, event.target.value)} className={inputClass} />
      : <input readOnly={readOnly} value={value[key] || ""} onChange={event => update(key, event.target.value)} className={inputClass} />}
  </label>;
  async function upload(file: File, label: string, apply: (url: string) => void) {
    if (!file.size || file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setError("Choose a JPG, PNG, WebP or GIF image up to 5 MB."); return;
    }
    setError(""); setUploading(label); onUploadStateChange(true);
    try {
      const response = await uploadDestinationImages({ galleryImages: [file] });
      const image = response.data.galleryImages[0];
      if (!image) throw new Error("The image could not be uploaded. Please try again.");
      apply(image);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Image upload failed."); }
    finally { setUploading(null); onUploadStateChange(false); }
  }
  const imageField = (label: string, image: string, apply: (url: string) => void) => <div className="grid gap-2">
    <label className="grid gap-2 text-xs font-semibold text-foreground/70">{label}<input className={inputClass} value={image} readOnly={readOnly} onChange={event => apply(event.target.value)} placeholder="Upload an image or enter its URL" /></label>
    {!readOnly ? <input aria-label={`Upload ${label}`} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="max-w-full text-xs" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file, label, apply); event.target.value = ""; }} /> : null}
    {image ? isGoogleMapsUrl(image) ? <a href={image} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Open Google Maps link</a> : <img src={getDestinationMediaUrl(image)} alt={`${label} preview`} className="h-24 w-36 rounded-sm object-cover" /> : null}
  </div>;
  const heading = (text: string) => <h4 className="col-span-full border-t border-border pt-5 text-sm font-bold text-foreground">{text}</h4>;
  return <fieldset disabled={disabled || !!uploading} className="grid gap-5 sm:col-span-2 sm:grid-cols-2">
    <legend className="mb-4 text-base font-bold text-foreground">Destination Page Content</legend>
    <p className="col-span-full text-xs leading-relaxed text-foreground/55">Key Attractions uses the Key Landmarks names and images above. Edit Things to Know, the banner quote, transport pointers and map here. The banner uses the existing destination name, region, recommended days, best time to visit and Banner Image.</p>
    {error ? <p role="alert" className="col-span-full text-sm text-red-600">{error}</p> : null}
    {uploading ? <p role="status" className="col-span-full text-sm text-primary">Uploading {uploading}…</p> : null}
    {heading("Things to Know & Quote")}
    <label className="grid gap-2 text-xs font-semibold sm:col-span-2">Things to Know (one pointer per line)<textarea readOnly={readOnly} rows={5} className={inputClass} value={(value.thingsToKnow || []).join("\n")} onChange={event => update("thingsToKnow", event.target.value.split("\n"))} /></label>
    {field("closingQuote", "Destination quote", true)}
    {heading("How to Reach & Map")}
    {field("byAir", "By air (one pointer per line)", true)}{field("byRail", "By train (one pointer per line)", true)}
    {field("byRoad", "By road (one pointer per line)", true)}
    {field("mapQuery", "Map location / address")}
    <label className="grid gap-2 text-xs font-semibold">Google Maps link (optional)<input className={inputClass} readOnly={readOnly} type="url" placeholder="https://maps.app.goo.gl/..." value={value.mapLink || (isGoogleMapsUrl(value.mapImage || "") ? value.mapImage : "") || ""} onChange={event => onChange({ ...value, mapLink:event.target.value, ...(isGoogleMapsUrl(value.mapImage || "") ? {mapImage:""} : {}) })} /><span className="font-normal text-foreground/55">Paste a Google Maps share link or embed URL. The saved address is used if no link is provided.</span></label>
    {imageField("Map image (optional)", isGoogleMapsUrl(value.mapImage || "") ? "" : value.mapImage || "", image => onChange({ ...value, ...(isGoogleMapsUrl(image) ? {mapLink:image,mapImage:""} : {mapImage:image}) }))}
    <p className="text-xs text-foreground/55">Map image accepts an uploaded image or a direct image URL. Use Google Maps link above for location links.</p>
  </fieldset>;
}
