"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Bold,
  CalendarDays,
  ChevronDown,
  Clock3,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  RemoveFormatting,
  Save,
  Search,
  Underline,
  Upload,
  X,
} from "lucide-react";

import {
  AdminDashboardShell,
  AdminSidebarToggle,
} from "@/components/admin-dashboard/admin-dashboard-shell";
import { HeaderDateRangePicker } from "@/components/admin-dashboard/header-date-range-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  createAdminBlog,
  getAdminBlog,
  getBlogMediaUrl,
  updateAdminBlog,
  uploadBlogImages,
  type AdminBlog,
  type BlogCategory,
  type BlogPayload,
  type BlogStatus,
} from "@/lib/blogs";
import { cn } from "@/lib/utils";

export type BlogEditorMode = "add" | "edit" | "view";

type BlogFormState = Omit<
  BlogPayload,
  "readTimeMinutes" | "popularRank"
> & {
  readTimeMinutes: string;
  popularRank: string;
};

const blogCategoryOptions: BlogCategory[] = [
  "Heritage",
  "History",
  "Art & Culture",
  "Travel Guide",
  "Destinations",
  "Travel Tips",
  "Uncategorized",
];
const blogStatusOptions: BlogStatus[] = ["Published", "Draft", "Archived"];
const dateTimeHourOptions = Array.from({ length: 12 }, (_item, index) =>
  String(index + 1).padStart(2, "0")
);
const dateTimeMinuteOptions = Array.from({ length: 60 }, (_item, index) =>
  String(index).padStart(2, "0")
);

const emptyBlogForm: BlogFormState = {
  blogId: "",
  title: "",
  slug: "",
  category: "Heritage",
  content: "",
  quote: "",
  authorName: "Ancient Trails",
  heroImage: "",
  seoTitle: "",
  seoDescription: "",
  seoKeywords: "",
  canonicalUrl: "",
  ogTitle: "",
  ogDescription: "",
  ogImage: "",
  status: "Draft",
  readTimeMinutes: "5",
  popularRank: "0",
  publishedAt: "",
};

const inputClassName =
  "h-11 rounded-sm border border-border bg-white px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60";
const textareaClassName =
  "min-h-24 rounded-sm border border-border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60";

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "details" in error &&
    Array.isArray((error as { details?: unknown }).details)
  ) {
    const details = (error as {
      details: Array<{ message?: unknown; path?: unknown }>;
    }).details;
    const detailMessages = details
      .map((detail) => {
        const message =
          typeof detail.message === "string" ? detail.message.trim() : "";
        const path =
          typeof detail.path === "string" && detail.path.trim()
            ? `${detail.path}: `
            : "";

        return message ? `${path}${message}` : "";
      })
      .filter(Boolean);

    if (detailMessages.length > 0) {
      return detailMessages.join(" ");
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function createSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function formatDateTimeInput(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffset = date.getTimezoneOffset() * 60 * 1000;

  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function parseDateTimeInputValue(value: string): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function dateToDateTimeInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDateTimePickerValue(value: string): string {
  const date = parseDateTimeInputValue(value);

  if (!date) {
    return "mm/dd/yyyy --:-- --";
  }

  return date.toLocaleString("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: true,
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function blogToForm(blog: AdminBlog): BlogFormState {
  return {
    blogId: blog.blogId,
    title: blog.title,
    slug: blog.slug,
    category: blog.category,
    content: blog.content,
    quote: blog.quote,
    authorName: blog.authorName,
    heroImage: blog.heroImage,
    seoTitle: blog.seoTitle,
    seoDescription: blog.seoDescription,
    seoKeywords: blog.seoKeywords,
    canonicalUrl: blog.canonicalUrl,
    ogTitle: blog.ogTitle,
    ogDescription: blog.ogDescription,
    ogImage: blog.ogImage,
    status: blog.status,
    readTimeMinutes: blog.readTimeMinutes.toString(),
    popularRank: blog.popularRank.toString(),
    publishedAt: formatDateTimeInput(blog.publishedAt),
  };
}

function createBlogPayload(form: BlogFormState): BlogPayload {
  return {
    blogId: form.blogId.trim(),
    title: form.title.trim(),
    slug: createSlug(form.slug || form.title),
    category: form.category,
    content: form.content.trim(),
    quote: form.quote.trim(),
    authorName: form.authorName.trim() || "Ancient Trails",
    heroImage: form.heroImage.trim(),
    seoTitle: form.seoTitle.trim(),
    seoDescription: form.seoDescription.trim(),
    seoKeywords: form.seoKeywords.trim(),
    canonicalUrl: form.canonicalUrl.trim(),
    ogTitle: form.ogTitle.trim(),
    ogDescription: form.ogDescription.trim(),
    ogImage: form.ogImage.trim(),
    status: form.status,
    readTimeMinutes: Number(form.readTimeMinutes) || 5,
    popularRank: Number(form.popularRank) || 0,
    publishedAt: form.publishedAt
      ? new Date(form.publishedAt).toISOString()
      : "",
  };
}

export function BlogEditorPage({
  blogId,
  mode,
}: {
  blogId?: string;
  mode: BlogEditorMode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [blogForm, setBlogForm] = useState<BlogFormState>(emptyBlogForm);
  const [selectedBlog, setSelectedBlog] = useState<AdminBlog | null>(null);
  const [isLoadingBlog, setIsLoadingBlog] = useState(
    mode !== "add" && Boolean(blogId)
  );
  const [loadError, setLoadError] = useState("");
  const [isSavingBlog, setIsSavingBlog] = useState(false);
  const [isUploadingHeroImage, setIsUploadingHeroImage] = useState(false);
  const isReadOnly = mode === "view";
  const isBusy = isSavingBlog || isUploadingHeroImage;
  const pageTitle =
    mode === "edit" ? "Edit Blog" : mode === "view" ? "View Blog" : "Add Blog";
  const pageDescription =
    mode === "edit"
      ? "Update the blog article, publishing details, and search metadata."
      : mode === "view"
        ? "Review the full blog record and SEO details."
        : "Create a complete blog article for the public website.";
  const submitButtonLabel = isSavingBlog
    ? "Saving..."
    : isUploadingHeroImage
      ? "Uploading image..."
      : mode === "edit"
        ? "Update Blog"
        : "Save Blog";
  const missingBlogIdError =
    mode !== "add" && !blogId ? "Blog ID is missing." : "";
  const currentLoadError = loadError || missingBlogIdError;

  useEffect(() => {
    if (mode === "add" || !blogId) {
      return;
    }

    let isMounted = true;
    const currentBlogId = blogId;

    async function loadBlog() {
      try {
        const response = await getAdminBlog(currentBlogId);

        if (isMounted) {
          setSelectedBlog(response.data.blog);
          setBlogForm(blogToForm(response.data.blog));
        }
      } catch (error) {
        const message = getErrorMessage(error);

        if (isMounted) {
          setLoadError(message);
        }

        toast.error("Unable to load blog", message);
      } finally {
        if (isMounted) {
          setIsLoadingBlog(false);
        }
      }
    }

    loadBlog();

    return () => {
      isMounted = false;
    };
  }, [blogId, mode, toast]);

  function updateBlogForm<K extends keyof BlogFormState>(
    field: K,
    value: BlogFormState[K]
  ) {
    setBlogForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function handleTitleChange(value: string) {
    setBlogForm((currentForm) => ({
      ...currentForm,
      title: value,
      slug: currentForm.slug ? currentForm.slug : createSlug(value),
    }));
  }

  async function handleHeroImageUpload(files: FileList | null) {
    const [heroImage] = Array.from(files || []);

    if (!heroImage) {
      return;
    }

    setIsUploadingHeroImage(true);

    try {
      const response = await uploadBlogImages({ heroImage });

      updateBlogForm("heroImage", response.data.heroImage);
      toast.success("Hero uploaded", response.message);
    } catch (error) {
      toast.error("Hero upload failed", getErrorMessage(error));
    } finally {
      setIsUploadingHeroImage(false);
    }
  }

  function handleRemoveHeroImage() {
    updateBlogForm("heroImage", "");
  }

  function handleUseHeroAsSocialImage() {
    if (!blogForm.heroImage.trim()) {
      toast.info("Hero image missing", "Upload or set a hero image first.");
      return;
    }

    updateBlogForm("ogImage", blogForm.heroImage);
  }

  async function handleSaveBlog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isReadOnly || isUploadingHeroImage) {
      return;
    }

    setIsSavingBlog(true);

    const payload = createBlogPayload(blogForm);

    try {
      if (mode === "edit" && selectedBlog) {
        const response = await updateAdminBlog(selectedBlog.id, payload);

        toast.success("Blog updated", response.message);
        router.push("/blog");
        router.refresh();
        return;
      }

      const response = await createAdminBlog(payload);

      toast.success("Blog added", response.message);
      router.push("/blog");
      router.refresh();
    } catch (error) {
      toast.error(
        mode === "edit" ? "Blog not updated" : "Blog not saved",
        getErrorMessage(error)
      );
    } finally {
      setIsSavingBlog(false);
    }
  }

  return (
    <AdminDashboardShell activeLabel="Blog">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <BlogEditorHeader current={pageTitle} />

        <form onSubmit={handleSaveBlog} className="flex flex-col gap-5">
          <section className="flex flex-col gap-4 rounded-sm border border-border bg-white p-5 shadow-sm shadow-stone-200/40 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <Button
                render={<Link href="/blog" />}
                type="button"
                variant="outline"
                className="mb-4 h-9 rounded-sm border-border bg-white px-3 text-xs font-bold"
              >
                <ArrowLeft className="size-4" data-icon="inline-start" />
                Back to Blog
              </Button>
              <h1 className="font-sans text-2xl font-bold tracking-normal text-foreground">
                {pageTitle}
              </h1>
              <p className="mt-1 text-sm text-foreground/60">
                {pageDescription}
              </p>
            </div>

            {!isReadOnly ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  render={<Link href="/blog" />}
                  type="button"
                  variant="outline"
                  className="h-11 rounded-sm border-border bg-white px-4 text-sm font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isBusy || isLoadingBlog || Boolean(currentLoadError)}
                  className="h-11 rounded-sm px-4 text-sm font-bold"
                >
                  <Save className="size-4" data-icon="inline-start" />
                  {submitButtonLabel}
                </Button>
              </div>
            ) : null}
          </section>

          {isLoadingBlog ? (
            <section className="grid min-h-60 place-items-center rounded-sm border border-border bg-white p-8 text-sm font-semibold text-foreground/55 shadow-sm shadow-stone-200/40">
              Loading blog...
            </section>
          ) : null}

          {!isLoadingBlog && currentLoadError ? (
            <section className="rounded-sm border border-border bg-white p-8 text-center shadow-sm shadow-stone-200/40">
              <p className="text-sm font-bold text-foreground">Blog not available</p>
              <p className="mt-2 text-xs text-foreground/55">{currentLoadError}</p>
            </section>
          ) : null}

          {!isLoadingBlog && !currentLoadError ? (
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
              <section className="rounded-sm border border-border bg-white p-5 shadow-sm shadow-stone-200/40">
                <div className="mb-5 flex items-center gap-2">
                  <FileText className="size-5 text-primary" />
                  <h2 className="font-sans text-lg font-bold tracking-normal text-foreground">
                    Article Content
                  </h2>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField label="Blog ID">
                    <input
                      readOnly={isReadOnly}
                      value={blogForm.blogId}
                      onChange={(event) =>
                        updateBlogForm("blogId", event.target.value)
                      }
                      className={inputClassName}
                      placeholder="BLOG-AJANTA-001"
                    />
                  </FormField>

                  <FormField label="Author">
                    <input
                      readOnly={isReadOnly}
                      value={blogForm.authorName}
                      onChange={(event) =>
                        updateBlogForm("authorName", event.target.value)
                      }
                      className={inputClassName}
                      placeholder="Ancient Trails"
                    />
                  </FormField>

                  <FormField className="sm:col-span-2" label="Title" required>
                    <input
                      required
                      readOnly={isReadOnly}
                      value={blogForm.title}
                      onChange={(event) => handleTitleChange(event.target.value)}
                      className={inputClassName}
                      placeholder="Ajanta Caves: A Timeless Masterpiece of Ancient India"
                    />
                  </FormField>

                  <FormField className="sm:col-span-2" label="Slug" required>
                    <input
                      required
                      readOnly={isReadOnly}
                      value={blogForm.slug}
                      onChange={(event) =>
                        updateBlogForm("slug", createSlug(event.target.value))
                      }
                      className={inputClassName}
                      placeholder="ajanta-caves-a-timeless-masterpiece-of-ancient-india"
                    />
                  </FormField>

                  <FormField className="sm:col-span-2" label="Content">
                    <RichTextEditor
                      readOnly={isReadOnly}
                      value={blogForm.content}
                      onChange={(value) => updateBlogForm("content", value)}
                    />
                  </FormField>

                  <FormField className="sm:col-span-2" label="Quote">
                    <textarea
                      readOnly={isReadOnly}
                      value={blogForm.quote}
                      onChange={(event) =>
                        updateBlogForm("quote", event.target.value)
                      }
                      className={textareaClassName}
                      placeholder="A highlighted article quote."
                    />
                  </FormField>
                </div>
              </section>

              <div className="flex flex-col gap-5">
                <section className="rounded-sm border border-border bg-white p-5 shadow-sm shadow-stone-200/40">
                  <h2 className="font-sans text-lg font-bold tracking-normal text-foreground">
                    Publishing
                  </h2>
                  <div className="mt-5 grid gap-5">
                    <FormField label="Status" required>
                      <Select
                        disabled={isReadOnly}
                        required
                        value={blogForm.status}
                        onValueChange={(value) => {
                          if (typeof value === "string") {
                            updateBlogForm("status", value as BlogStatus);
                          }
                        }}
                      >
                        <SelectTrigger className={inputClassName}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {blogStatusOptions.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>

                    <FormField label="Category" required>
                      <Select
                        disabled={isReadOnly}
                        required
                        value={blogForm.category}
                        onValueChange={(value) => {
                          if (typeof value === "string") {
                            updateBlogForm("category", value as BlogCategory);
                          }
                        }}
                      >
                        <SelectTrigger className={inputClassName}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {blogCategoryOptions.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>

                    <FormField label="Read Time (Minutes)" required>
                      <input
                        required
                        min={1}
                        readOnly={isReadOnly}
                        type="number"
                        value={blogForm.readTimeMinutes}
                        onChange={(event) =>
                          updateBlogForm("readTimeMinutes", event.target.value)
                        }
                        className={inputClassName}
                      />
                    </FormField>

                    <FormField label="Published At">
                      <DateTimePicker
                        readOnly={isReadOnly}
                        value={blogForm.publishedAt}
                        onChange={(value) => updateBlogForm("publishedAt", value)}
                        triggerClassName={inputClassName}
                      />
                    </FormField>

                    <FormField label="Popular Rank">
                      <input
                        min={0}
                        readOnly={isReadOnly}
                        type="number"
                        value={blogForm.popularRank}
                        onChange={(event) =>
                          updateBlogForm("popularRank", event.target.value)
                        }
                        className={inputClassName}
                      />
                    </FormField>
                  </div>
                </section>

                <section className="rounded-sm border border-border bg-white p-5 shadow-sm shadow-stone-200/40">
                  <h2 className="font-sans text-lg font-bold tracking-normal text-foreground">
                    Media
                  </h2>
                  <div className="mt-5 grid gap-4">
                    {!isReadOnly ? (
                      <UploadField
                        accept="image/*"
                        disabled={isBusy}
                        isUploading={isUploadingHeroImage}
                        label="Upload hero image"
                        onFilesSelected={handleHeroImageUpload}
                      />
                    ) : null}
                    <ImagePreview
                      image={blogForm.heroImage}
                      label="Blog hero preview"
                      onRemove={!isReadOnly ? handleRemoveHeroImage : undefined}
                    />
                  </div>
                </section>

                <section className="rounded-sm border border-border bg-white p-5 shadow-sm shadow-stone-200/40">
                  <div className="mb-5 flex items-center gap-2">
                    <Search className="size-5 text-primary" />
                    <h2 className="font-sans text-lg font-bold tracking-normal text-foreground">
                      SEO
                    </h2>
                  </div>

                  <div className="grid gap-5">
                    <FormField label="SEO Title">
                      <input
                        maxLength={70}
                        readOnly={isReadOnly}
                        value={blogForm.seoTitle}
                        onChange={(event) =>
                          updateBlogForm("seoTitle", event.target.value)
                        }
                        className={inputClassName}
                        placeholder="Ajanta Caves Travel Guide"
                      />
                      <CharacterCount value={blogForm.seoTitle} max={70} />
                    </FormField>

                    <FormField label="SEO Description">
                      <textarea
                        maxLength={170}
                        readOnly={isReadOnly}
                        value={blogForm.seoDescription}
                        onChange={(event) =>
                          updateBlogForm("seoDescription", event.target.value)
                        }
                        className={textareaClassName}
                        placeholder="Plan your Ajanta Caves visit with history, art highlights, travel tips, and heritage context."
                      />
                      <CharacterCount value={blogForm.seoDescription} max={170} />
                    </FormField>

                    <FormField label="SEO Keywords">
                      <input
                        maxLength={300}
                        readOnly={isReadOnly}
                        value={blogForm.seoKeywords}
                        onChange={(event) =>
                          updateBlogForm("seoKeywords", event.target.value)
                        }
                        className={inputClassName}
                        placeholder="Ajanta Caves, heritage travel, India history"
                      />
                    </FormField>

                    <FormField label="Canonical URL">
                      <input
                        readOnly={isReadOnly}
                        value={blogForm.canonicalUrl}
                        onChange={(event) =>
                          updateBlogForm("canonicalUrl", event.target.value)
                        }
                        className={inputClassName}
                        placeholder="https://ancienttrails.com/blog/ajanta-caves"
                      />
                    </FormField>

                    <FormField label="Open Graph Title">
                      <input
                        maxLength={95}
                        readOnly={isReadOnly}
                        value={blogForm.ogTitle}
                        onChange={(event) =>
                          updateBlogForm("ogTitle", event.target.value)
                        }
                        className={inputClassName}
                        placeholder="Ajanta Caves: Heritage Travel Guide"
                      />
                      <CharacterCount value={blogForm.ogTitle} max={95} />
                    </FormField>

                    <FormField label="Open Graph Description">
                      <textarea
                        maxLength={220}
                        readOnly={isReadOnly}
                        value={blogForm.ogDescription}
                        onChange={(event) =>
                          updateBlogForm("ogDescription", event.target.value)
                        }
                        className={textareaClassName}
                        placeholder="A heritage-first guide to the stories, paintings, and planning details behind Ajanta Caves."
                      />
                      <CharacterCount value={blogForm.ogDescription} max={220} />
                    </FormField>

                    <FormField label="Open Graph Image">
                      <input
                        readOnly={isReadOnly}
                        value={blogForm.ogImage}
                        onChange={(event) =>
                          updateBlogForm("ogImage", event.target.value)
                        }
                        className={inputClassName}
                        placeholder="/uploads/blogs/hero-image.webp"
                      />
                      {!isReadOnly ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleUseHeroAsSocialImage}
                          className="h-9 rounded-sm border-border bg-white px-3 text-xs font-bold"
                        >
                          Use Hero Image
                        </Button>
                      ) : null}
                      <ImagePreview
                        image={blogForm.ogImage}
                        label="Open graph preview"
                        onRemove={
                          !isReadOnly
                            ? () => updateBlogForm("ogImage", "")
                            : undefined
                        }
                      />
                    </FormField>
                  </div>
                </section>
              </div>
            </div>
          ) : null}
        </form>
      </div>
    </AdminDashboardShell>
  );
}

function BlogEditorHeader({ current }: { current: string }) {
  const toast = useToast();

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <AdminSidebarToggle />
        <div className="min-w-0">
          <h1 className="font-sans text-2xl font-bold tracking-normal text-foreground">
            Blog
          </h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-foreground/55">
            <span>Dashboard</span>
            <span aria-hidden="true">&gt;</span>
            <Link href="/blog" className="font-medium text-foreground/75">
              Blog
            </Link>
            <span aria-hidden="true">&gt;</span>
            <span className="font-medium text-foreground/75">{current}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <HeaderDateRangePicker />
        <button
          onClick={() =>
            toast.info("Notifications", "You have 3 blog notifications.")
          }
          className="relative grid size-10 place-items-center rounded-sm border border-border bg-white text-foreground transition-colors hover:border-primary hover:text-primary"
          type="button"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
          <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-white">
            3
          </span>
        </button>
        <button
          onClick={() =>
            toast.info("Admin profile", "Profile menu will open here.")
          }
          className="flex h-10 items-center gap-2 rounded-sm border border-border bg-white px-2.5 text-sm font-semibold transition-colors hover:border-primary"
          type="button"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#7a3b22] text-xs font-bold text-white">
            AU
          </span>
          <span className="hidden sm:inline">Admin User</span>
          <ChevronDown className="size-4 text-foreground/45" />
        </button>
      </div>
    </header>
  );
}

function DateTimePicker({
  onChange,
  readOnly = false,
  triggerClassName,
  value,
}: {
  onChange: (value: string) => void;
  readOnly?: boolean;
  triggerClassName?: string;
  value: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedDate = parseDateTimeInputValue(value);
  const timeSource = selectedDate || new Date();
  const hour24 = timeSource.getHours();
  const hour12 = hour24 % 12 || 12;
  const minute = String(timeSource.getMinutes()).padStart(2, "0");
  const period = hour24 >= 12 ? "PM" : "AM";

  function commitDate(nextDate: Date) {
    const baseDate = selectedDate || new Date();
    const nextValue = new Date(
      nextDate.getFullYear(),
      nextDate.getMonth(),
      nextDate.getDate(),
      baseDate.getHours(),
      baseDate.getMinutes()
    );

    onChange(dateToDateTimeInputValue(nextValue));
  }

  function commitTime(nextHour: number, nextMinute: number) {
    const baseDate = selectedDate || new Date();
    const nextValue = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
      nextHour,
      nextMinute
    );

    onChange(dateToDateTimeInputValue(nextValue));
  }

  function handleHourChange(nextHourValue: string | null) {
    if (!nextHourValue) {
      return;
    }

    const nextHour12 = Number(nextHourValue);
    const nextHour24 =
      nextHour12 === 12
        ? period === "PM"
          ? 12
          : 0
        : nextHour12 + (period === "PM" ? 12 : 0);

    commitTime(nextHour24, timeSource.getMinutes());
  }

  function handleMinuteChange(nextMinuteValue: string | null) {
    if (!nextMinuteValue) {
      return;
    }

    commitTime(hour24, Number(nextMinuteValue));
  }

  function handlePeriodChange(nextPeriod: string | null) {
    if (!nextPeriod) {
      return;
    }

    const nextHour24 =
      nextPeriod === "PM" ? (hour24 % 12) + 12 : hour24 % 12;

    commitTime(nextHour24, timeSource.getMinutes());
  }

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        if (!readOnly) {
          setIsOpen(open);
        }
      }}
    >
      <PopoverTrigger
        type="button"
        disabled={readOnly}
        className={cn(
          triggerClassName,
          "flex w-full items-center justify-between gap-3 text-left font-medium",
          !value && "text-foreground/45"
        )}
      >
        <span>{formatDateTimePickerValue(value)}</span>
        <CalendarDays className="size-4 shrink-0 text-foreground/55" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[min(calc(100vw-2rem),496px)] p-3"
      >
        <div className="grid gap-4 sm:grid-cols-[292px_minmax(0,1fr)]">
          <Calendar
            key={selectedDate?.toDateString() || "empty-blog-date-time"}
            selected={selectedDate}
            onSelect={commitDate}
            onClear={() => {
              onChange("");
              setIsOpen(false);
            }}
          />

          <div className="flex min-w-0 flex-col rounded-sm border border-border bg-muted/25 p-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-normal text-foreground/55">
              <Clock3 className="size-4 text-primary" />
              Time
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Select
                value={String(hour12).padStart(2, "0")}
                onValueChange={handleHourChange}
              >
                <SelectTrigger className="h-10 min-h-10 rounded-sm border-border bg-white px-2 text-sm font-semibold text-foreground">
                  <span className="min-w-0 flex-1 text-center leading-none">
                    {String(hour12).padStart(2, "0")}
                  </span>
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {dateTimeHourOptions.map((hour) => (
                    <SelectItem key={hour} value={hour}>
                      {hour}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={minute} onValueChange={handleMinuteChange}>
                <SelectTrigger className="h-10 min-h-10 rounded-sm border-border bg-white px-2 text-sm font-semibold text-foreground">
                  <span className="min-w-0 flex-1 text-center leading-none">
                    {minute}
                  </span>
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {dateTimeMinuteOptions.map((minuteOption) => (
                    <SelectItem key={minuteOption} value={minuteOption}>
                      {minuteOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={period} onValueChange={handlePeriodChange}>
                <SelectTrigger className="h-10 min-h-10 rounded-sm border-border bg-white px-2 text-sm font-semibold text-foreground">
                  <span className="min-w-0 flex-1 text-center leading-none">
                    {period}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AM">AM</SelectItem>
                  <SelectItem value="PM">PM</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  onChange(dateToDateTimeInputValue(now));
                }}
                className="h-9 rounded-sm border border-primary/25 bg-white px-3 text-xs font-bold text-primary transition-colors hover:bg-primary/10"
              >
                Now
              </button>
              <Button
                type="button"
                onClick={() => setIsOpen(false)}
                className="h-9 rounded-sm text-xs font-bold"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const richTextBlockButtons = [
  { label: "Paragraph", icon: Pilcrow, value: "P" },
  { label: "Heading 1", icon: Heading1, value: "H1" },
  { label: "Heading 2", icon: Heading2, value: "H2" },
  { label: "Heading 3", icon: Heading3, value: "H3" },
];

const richTextInlineButtons = [
  { label: "Bold", icon: Bold, command: "bold" },
  { label: "Italic", icon: Italic, command: "italic" },
  { label: "Underline", icon: Underline, command: "underline" },
  { label: "Bulleted list", icon: List, command: "insertUnorderedList" },
  { label: "Numbered list", icon: ListOrdered, command: "insertOrderedList" },
  { label: "Quote", icon: Quote, command: "formatBlock", value: "BLOCKQUOTE" },
];

function RichTextEditor({
  onChange,
  readOnly,
  value,
}: {
  onChange: (value: string) => void;
  readOnly: boolean;
  value: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = editorRef.current;

    if (editor && editor.innerHTML !== value) {
      editor.innerHTML = value;
    }
  }, [value]);

  function updateValueFromEditor() {
    onChange(editorRef.current?.innerHTML || "");
  }

  function runEditorCommand(command: string, commandValue?: string) {
    if (readOnly) {
      return;
    }

    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    updateValueFromEditor();
  }

  function addLink() {
    if (readOnly) {
      return;
    }

    editorRef.current?.focus();

    const rawUrl = window.prompt("Enter the link URL");

    if (!rawUrl?.trim()) {
      return;
    }

    const trimmedUrl = rawUrl.trim();
    const safeUrl = /^(https?:|mailto:|tel:|#)/i.test(trimmedUrl)
      ? trimmedUrl
      : `https://${trimmedUrl}`;

    document.execCommand("createLink", false, safeUrl);
    updateValueFromEditor();
  }

  function clearFormatting() {
    if (readOnly) {
      return;
    }

    runEditorCommand("removeFormat");
    runEditorCommand("formatBlock", "P");
  }

  return (
    <div className="overflow-hidden rounded-sm border border-border bg-white">
      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/35 p-2">
          {richTextBlockButtons.map(({ icon: Icon, label, value: blockValue }) => (
            <RichTextToolbarButton
              key={label}
              label={label}
              onAction={() => runEditorCommand("formatBlock", blockValue)}
            >
              <Icon className="size-4" />
            </RichTextToolbarButton>
          ))}
          <span className="mx-1 h-6 w-px bg-border" />
          {richTextInlineButtons.map(
            ({ command, icon: Icon, label, value: commandValue }) => (
              <RichTextToolbarButton
                key={label}
                label={label}
                onAction={() => runEditorCommand(command, commandValue)}
              >
                <Icon className="size-4" />
              </RichTextToolbarButton>
            )
          )}
          <span className="mx-1 h-6 w-px bg-border" />
          <RichTextToolbarButton label="Add link" onAction={addLink}>
            <Link2 className="size-4" />
          </RichTextToolbarButton>
          <RichTextToolbarButton label="Clear formatting" onAction={clearFormatting}>
            <RemoveFormatting className="size-4" />
          </RichTextToolbarButton>
        </div>
      ) : null}

      <div
        ref={editorRef}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        data-placeholder="Write or paste your formatted blog content here..."
        onBlur={updateValueFromEditor}
        onInput={updateValueFromEditor}
        className={cn(
          "min-h-96 overflow-y-auto px-4 py-3 text-sm leading-relaxed outline-none empty:before:text-foreground/35 empty:before:content-[attr(data-placeholder)]",
          "read-only:cursor-default",
          "[&_a]:font-semibold [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:bg-primary/5 [&_blockquote]:px-4 [&_blockquote]:py-3 [&_blockquote]:italic",
          "[&_h1]:font-sans [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:font-sans [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:font-sans [&_h3]:text-xl [&_h3]:font-bold",
          "[&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
        )}
      />
    </div>
  );
}

function RichTextToolbarButton({
  children,
  label,
  onAction,
}: {
  children: ReactNode;
  label: string;
  onAction: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(event) => {
        event.preventDefault();
        onAction();
      }}
      className="grid size-8 place-items-center rounded-sm border border-transparent bg-white text-foreground/70 transition-colors hover:border-primary hover:text-primary"
    >
      {children}
    </button>
  );
}

function ImagePreview({
  image,
  label,
  onRemove,
}: {
  image: string;
  label: string;
  onRemove?: () => void;
}) {
  const trimmedImage = image.trim();

  if (!trimmedImage) {
    return (
      <div className="grid h-32 place-items-center rounded-sm border border-dashed border-border bg-muted/35 text-xs font-medium text-foreground/45">
        Preview will appear here
      </div>
    );
  }

  return (
    <div className="relative h-36 overflow-hidden rounded-sm border border-border bg-muted">
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1.5 top-1.5 z-10 grid size-6 place-items-center rounded-sm border border-white/70 bg-white/95 text-foreground shadow-sm transition-colors hover:border-primary hover:text-primary"
          aria-label={`Remove ${label.toLowerCase()}`}
        >
          <X className="size-3.5" />
        </button>
      ) : null}
      <div
        className="h-full w-full bg-cover bg-center"
        role="img"
        aria-label={label}
        style={{
          backgroundImage: `url("${getBlogMediaUrl(trimmedImage)}")`,
        }}
      />
    </div>
  );
}

function UploadField({
  accept,
  disabled,
  isUploading,
  label,
  onFilesSelected,
}: {
  accept: string;
  disabled: boolean;
  isUploading: boolean;
  label: string;
  onFilesSelected: (files: FileList | null) => void;
}) {
  return (
    <label
      className={cn(
        "flex h-11 cursor-pointer items-center justify-center gap-2 rounded-sm border border-dashed border-primary/30 bg-primary/5 px-3 text-sm font-bold text-primary transition-colors hover:border-primary hover:bg-primary/10",
        disabled && "pointer-events-none cursor-not-allowed opacity-60"
      )}
    >
      <Upload className="size-4 shrink-0" />
      <span>{isUploading ? "Uploading..." : label}</span>
      <input
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          onFilesSelected(event.target.files);
          event.target.value = "";
        }}
        type="file"
      />
    </label>
  );
}

function FormField({
  children,
  className,
  label,
  required = false,
}: {
  children: ReactNode;
  className?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <span className="text-xs font-bold uppercase tracking-normal text-foreground/55">
        {label}
        {required ? <span className="text-primary"> *</span> : null}
      </span>
      {children}
    </div>
  );
}

function CharacterCount({ max, value }: { max: number; value: string }) {
  return (
    <span className="text-right text-[11px] font-semibold text-foreground/45">
      {value.length}/{max}
    </span>
  );
}
