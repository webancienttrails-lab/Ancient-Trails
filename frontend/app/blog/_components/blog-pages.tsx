"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Folder,
  Home,
  Landmark,
  Lightbulb,
  Link2,
  Mail,
  Map,
  MapPin,
  Palette,
  PenLine,
  Send,
  Share2,
  type LucideIcon,
} from "lucide-react";

import { Header } from "@/components/layout/header";
import {
  getBlogMediaUrl,
  getPublishedBlog,
  listPublishedBlogs,
  type BlogCategory,
  type BlogCategoryCount,
  type PublicBlog,
} from "@/lib/blogs";
import { cn } from "@/lib/utils";

type SortMode = "Latest" | "Oldest";

type CategoryTheme = {
  badge: string;
  border: string;
  icon: string;
  surface: string;
  text: string;
};

type SidebarTour = {
  date: string;
  duration: string;
  href: string;
  image: string;
  title: string;
};

const categoryIcons: Record<BlogCategory, LucideIcon> = {
  Heritage: Landmark,
  History: Building2,
  "Art & Culture": Palette,
  "Travel Guide": Map,
  Destinations: MapPin,
  "Travel Tips": Lightbulb,
  Uncategorized: Folder,
};

const blogCategories: BlogCategory[] = [
  "Heritage",
  "History",
  "Art & Culture",
  "Travel Guide",
  "Destinations",
  "Travel Tips",
  "Uncategorized",
];

const categoryThemes: Record<BlogCategory, CategoryTheme> = {
  Heritage: {
    badge: "border-primary/35 bg-primary/10 text-primary",
    border: "border-primary/25",
    icon: "bg-primary/10 text-primary",
    surface: "bg-primary/5",
    text: "text-primary",
  },
  History: {
    badge: "border-accent/30 bg-accent/10 text-accent",
    border: "border-accent/25",
    icon: "bg-accent/10 text-accent",
    surface: "bg-accent/5",
    text: "text-accent",
  },
  "Art & Culture": {
    badge: "border-primary/35 bg-primary/10 text-primary",
    border: "border-primary/25",
    icon: "bg-primary/10 text-primary",
    surface: "bg-primary/5",
    text: "text-primary",
  },
  "Travel Guide": {
    badge: "border-accent/30 bg-accent/10 text-accent",
    border: "border-accent/25",
    icon: "bg-accent/10 text-accent",
    surface: "bg-accent/5",
    text: "text-accent",
  },
  Destinations: {
    badge: "border-primary/35 bg-primary/10 text-primary",
    border: "border-primary/25",
    icon: "bg-primary/10 text-primary",
    surface: "bg-primary/5",
    text: "text-primary",
  },
  "Travel Tips": {
    badge: "border-accent/30 bg-accent/10 text-accent",
    border: "border-accent/25",
    icon: "bg-accent/10 text-accent",
    surface: "bg-accent/5",
    text: "text-accent",
  },
  Uncategorized: {
    badge: "border-secondary/20 bg-secondary/10 text-secondary/75",
    border: "border-secondary/15",
    icon: "bg-secondary/10 text-secondary/70",
    surface: "bg-[#f8f7f5]",
    text: "text-secondary/75",
  },
};

const sidebarTours: SidebarTour[] = [
  {
    title: "Khajuraho",
    duration: "6 Days / 5 Nights",
    date: "16 Jul 2026",
    image: "/home assets/Khajuraho.webp",
    href: "/#upcoming-tours",
  },
  {
    title: "Incredible Indonesia",
    duration: "9 Days / 8 Nights",
    date: "8 Jul 2026",
    image: "/home assets/Indonesia.webp",
    href: "/#upcoming-tours",
  },
];

function getPostTime(post: PublicBlog): number {
  const date = new Date(post.publishedAt || post.createdAt);

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getSortedBlogs(blogs: PublicBlog[], sortMode: SortMode): PublicBlog[] {
  return [...blogs].sort((left, right) =>
    sortMode === "Latest"
      ? getPostTime(right) - getPostTime(left)
      : getPostTime(left) - getPostTime(right)
  );
}

function getPopularPosts(blogs: PublicBlog[]): PublicBlog[] {
  return [...blogs]
    .sort((left, right) => {
      const leftRank = left.popularRank || 999;
      const rightRank = right.popularRank || 999;

      return leftRank - rightRank || getPostTime(right) - getPostTime(left);
    })
    .slice(0, 5);
}

function getCategoryCounts(
  blogs: PublicBlog[],
  apiCounts: BlogCategoryCount[] = []
): BlogCategoryCount[] {
  const apiCountByCategory = new globalThis.Map(
    apiCounts.map((item) => [item.category, item.count])
  );

  return blogCategories.map((category) => ({
    category,
    count:
      apiCountByCategory.get(category) ??
      blogs.filter((blog) => blog.category === category).length,
  }));
}

function getHeroImage(post?: PublicBlog | null): string {
  return post?.heroImage || "/home assets/Caves.webp";
}

function getCategoryTheme(category: BlogCategory): CategoryTheme {
  return categoryThemes[category] || categoryThemes.Uncategorized;
}

function BlogImage({
  className,
  image,
  label,
}: {
  className?: string;
  image: string;
  label: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn("bg-cover bg-center", className)}
      style={{
        backgroundImage: `url("${getBlogMediaUrl(image)}")`,
      }}
    />
  );
}

function Breadcrumb({
  current,
  light = false,
}: {
  current?: string;
  light?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 text-[13px] font-semibold",
        light ? "text-white/88" : "text-secondary/70"
      )}
    >
      <Link href="/" className="inline-flex items-center gap-1.5 hover:text-primary">
        <Home className="size-3.5" />
        Home
      </Link>
      <ChevronRight className="size-3.5 opacity-60" />
      <Link href="/blog" className="hover:text-primary">
        Blog
      </Link>
      {current ? (
        <>
          <ChevronRight className="size-3.5 opacity-60" />
          <span className="line-clamp-1">{current}</span>
        </>
      ) : null}
    </div>
  );
}

function BlogListHero() {
  return (
    <section className="relative min-h-[260px] overflow-hidden sm:min-h-[300px]">
      <BlogImage
        image="/home assets/Caves.webp"
        label="Ancient rock-cut caves"
        className="absolute inset-0"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#211009]/90 via-[#7a310e]/58 to-primary/20" />
      <div className="relative z-10 mx-auto flex min-h-[260px] w-full max-w-[1320px] flex-col justify-center px-4 py-8 text-white sm:min-h-[300px] sm:px-5">
        <div className="mb-10 sm:mb-14">
          <Breadcrumb light />
        </div>
        <h1 className="font-heading text-[34px] font-bold leading-[1.08] tracking-normal sm:text-[44px] lg:text-[48px]">
          Travel Blog
        </h1>
        <p className="mt-4 max-w-[430px] text-[15px] font-semibold leading-[1.7] text-white/92 sm:text-[17px]">
          Stories, guides and inspiration from the world of heritage travel.
        </p>
      </div>
    </section>
  );
}

function CategoryBadge({
  category,
  className,
}: {
  category: BlogCategory;
  className?: string;
}) {
  const theme = getCategoryTheme(category);

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-bold leading-none shadow-[0_8px_18px_rgba(50,50,50,0.08)] backdrop-blur-sm",
        theme.badge,
        className
      )}
    >
      {category}
    </span>
  );
}

function getCardImage(post: PublicBlog): string {
  return post.heroImage || "/home assets/Caves.webp";
}

function BlogCard({ post }: { post: PublicBlog }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex h-full min-h-[388px] flex-col overflow-hidden rounded-[8px] border border-border bg-white p-2 shadow-[0_14px_32px_rgba(50,50,50,0.055)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_20px_42px_rgba(50,50,50,0.11)]"
    >
      <div className="relative overflow-hidden rounded-[7px]">
        <BlogImage
          image={getCardImage(post)}
          label={post.title}
          className="aspect-[16/9] w-full transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <CategoryBadge
          category={post.category}
          className="absolute left-3 top-3 sm:left-4 sm:top-4"
        />
      </div>
      <div className="flex flex-1 flex-col px-2 pb-5 pt-5 sm:px-3">
        <h2 className="line-clamp-2 font-heading text-[21px] font-bold leading-[1.15] tracking-normal text-secondary transition-colors group-hover:text-primary sm:text-[23px]">
          {post.title}
        </h2>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px] font-medium text-secondary/55">
          <span className="line-clamp-1">{post.authorName}</span>
          <span className="inline-flex items-center gap-2">
            <Clock3 className="size-4" />
            {formatDate(post.publishedAt)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function SidebarCard({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[8px] border border-border bg-white p-5 shadow-[0_12px_34px_rgba(50,50,50,0.055)] sm:p-6",
        className
      )}
    >
      <h2 className="font-heading text-[20px] font-bold leading-none tracking-normal text-secondary sm:text-[21px]">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ExploreToursCard() {
  return (
    <SidebarCard title="Explore Tours">
      <div className="space-y-4">
        {sidebarTours.slice(0, 1).map((tour) => (
          <article
            key={tour.title}
            className="overflow-hidden rounded-[7px] border border-primary/20 bg-primary/5"
          >
            <BlogImage
              image={tour.image}
              label={`${tour.title} tour`}
              className="h-[118px]"
            />
            <div className="p-4">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase text-primary">
                <CalendarDays className="size-3.5" />
                {tour.date}
              </div>
              <h3 className="mt-2 font-heading text-[18px] font-bold leading-[1.18] tracking-normal text-secondary">
                {tour.title}
              </h3>
              <p className="mt-1 text-[12px] font-medium text-secondary/65">
                {tour.duration}
              </p>
              <Link
                href={tour.href}
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[5px] bg-primary px-4 text-[13px] font-bold text-white transition-colors hover:bg-accent"
              >
                Explore
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </article>
        ))}
        <Link
          href="/#upcoming-tours"
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[5px] border border-primary bg-white px-4 text-[13px] font-bold text-primary transition-colors hover:bg-primary hover:text-white"
        >
          View All
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </SidebarCard>
  );
}

function PopularPostLink({ post }: { post: PublicBlog }) {
  const Icon = categoryIcons[post.category];
  const theme = getCategoryTheme(post.category);

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 text-secondary transition-colors hover:text-primary"
    >
      <span
        className={cn(
          "grid size-11 place-items-center rounded-[6px]",
          theme.icon
        )}
        aria-hidden="true"
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="line-clamp-2 text-[12px] font-semibold leading-[1.35]">
          {post.title}
        </span>
        <span className="mt-1 block text-[11px] font-medium text-secondary/60">
          {formatDate(post.publishedAt)}
        </span>
      </span>
    </Link>
  );
}

function BlogSidebar({
  categoryCounts,
  onCategorySelect,
  popularPosts,
  selectedCategory,
}: {
  categoryCounts: BlogCategoryCount[];
  onCategorySelect?: (category: BlogCategory | "All") => void;
  popularPosts: PublicBlog[];
  selectedCategory?: BlogCategory | "All";
}) {
  return (
    <aside className="flex h-full flex-col gap-6 lg:sticky lg:top-28 lg:self-stretch">
      <SidebarCard title="Categories">
        <div className="space-y-3">
          {categoryCounts.map(({ category, count }) => {
            const Icon = categoryIcons[category];
            const isActive = selectedCategory === category;
            const content = (
              <>
                <span className="flex min-w-0 items-center gap-3">
                  <Icon className="size-4 shrink-0 text-primary" />
                  <span className="truncate">{category}</span>
                </span>
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                  {count}
                </span>
              </>
            );

            if (!onCategorySelect) {
              return (
                <Link
                  key={category}
                  href="/blog"
                  className="flex items-center justify-between gap-3 rounded-[6px] px-1 py-1.5 text-[14px] font-medium text-secondary transition-colors hover:text-primary"
                >
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={category}
                type="button"
                onClick={() => onCategorySelect(category)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-[6px] px-1 py-1.5 text-left text-[14px] font-medium text-secondary transition-colors hover:text-primary",
                  isActive && "text-primary"
                )}
              >
                {content}
              </button>
            );
          })}
        </div>
      </SidebarCard>

      <SidebarCard title="Popular Posts">
        <div className="space-y-4">
          {popularPosts.slice(0, 5).map((post) => (
            <PopularPostLink key={post.slug} post={post} />
          ))}
        </div>
      </SidebarCard>

      <ExploreToursCard />

      <div className="flex flex-1 flex-col">
        <SidebarCard className="h-full" title="Share Your Story">
          <p className="text-[13px] leading-[1.7] text-secondary/76">
            Have a travel story to share? We&apos;d love to feature it.
          </p>
          <Link
            href="mailto:hello@ancienttrails.example?subject=Travel%20Story"
            className="mt-4 flex h-11 items-center justify-center gap-2 rounded-[5px] border border-primary bg-white px-4 text-[13px] font-bold text-primary transition-colors hover:bg-primary hover:text-white"
          >
            Submit Your Story
            <PenLine className="size-4" />
          </Link>
        </SidebarCard>
      </div>
    </aside>
  );
}

function Pagination() {
  return (
    <div className="mt-8 flex items-center justify-center gap-2">
      <button
        type="button"
        aria-label="Previous page"
        className="grid size-9 place-items-center rounded-[5px] border border-border bg-white text-secondary/65"
      >
        <ChevronLeft className="size-4" />
      </button>
      {[1, 2, 3].map((page) => (
        <button
          key={page}
          type="button"
          className={cn(
            "grid size-9 place-items-center rounded-[5px] border border-border bg-white text-[13px] font-semibold text-secondary",
            page === 1 && "border-primary bg-primary text-white"
          )}
        >
          {page}
        </button>
      ))}
      <span className="grid size-9 place-items-center text-[13px] font-semibold text-secondary/70">
        ...
      </span>
      <button
        type="button"
        className="grid size-9 place-items-center rounded-[5px] border border-border bg-white text-[13px] font-semibold text-secondary"
      >
        8
      </button>
      <button
        type="button"
        aria-label="Next page"
        className="grid size-9 place-items-center rounded-[5px] border border-border bg-white text-secondary/65"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

export function BlogListPage() {
  const [blogs, setBlogs] = useState<PublicBlog[]>([]);
  const [popularPosts, setPopularPosts] = useState<PublicBlog[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<BlogCategoryCount[]>(() =>
    getCategoryCounts([])
  );
  const [isLoadingBlogs, setIsLoadingBlogs] = useState(true);
  const [blogLoadError, setBlogLoadError] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("Latest");
  const [selectedCategory, setSelectedCategory] = useState<BlogCategory | "All">(
    "All"
  );

  useEffect(() => {
    let isMounted = true;

    async function loadBlogs() {
      setIsLoadingBlogs(true);
      setBlogLoadError("");

      try {
        const response = await listPublishedBlogs();
        const nextBlogs = response.data.blogs;

        if (isMounted) {
          setBlogs(nextBlogs);
          setPopularPosts(
            response.data.popularPosts.length
              ? response.data.popularPosts
              : getPopularPosts(nextBlogs)
          );
          setCategoryCounts(getCategoryCounts(nextBlogs, response.data.categories));
        }
      } catch {
        if (isMounted) {
          setBlogs([]);
          setPopularPosts([]);
          setCategoryCounts(getCategoryCounts([]));
          setBlogLoadError("Unable to load blog posts right now.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingBlogs(false);
        }
      }
    }

    loadBlogs();

    return () => {
      isMounted = false;
    };
  }, []);

  const visibleBlogs = useMemo(() => {
    const filteredBlogs = blogs.filter(
      (post) => selectedCategory === "All" || post.category === selectedCategory
    );

    return getSortedBlogs(filteredBlogs, sortMode);
  }, [blogs, selectedCategory, sortMode]);

  return (
    <main className="min-h-screen bg-background text-secondary">
      <Header />
      <BlogListHero />

      <section className="mx-auto grid w-full max-w-[1320px] items-stretch gap-8 px-4 py-8 sm:px-5 sm:py-10 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="flex min-w-0 flex-col">
          <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setSelectedCategory("All")}
              className={cn(
                "flex w-fit items-center gap-2 text-[15px] font-bold text-primary",
                selectedCategory !== "All" && "text-secondary/65"
              )}
            >
              <BookOpen className="size-5" />
              All Blogs
            </button>
            <label className="relative w-full sm:w-[150px]">
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="h-11 w-full appearance-none rounded-[5px] border border-border bg-white px-4 pr-10 text-[13px] font-medium text-secondary outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15"
              >
                <option>Latest</option>
                <option>Oldest</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-secondary/55" />
            </label>
          </div>

          {isLoadingBlogs ? (
            <div className="rounded-[8px] border border-border bg-white p-8 text-center text-[14px] font-medium text-secondary/65">
              Loading blog posts...
            </div>
          ) : null}

          {!isLoadingBlogs && blogLoadError ? (
            <div className="rounded-[8px] border border-border bg-white p-8 text-center text-[14px] font-medium text-secondary/65">
              {blogLoadError}
            </div>
          ) : null}

          {!isLoadingBlogs && !blogLoadError && visibleBlogs.length > 0 ? (
            <div className="grid gap-8 md:grid-cols-2">
              {visibleBlogs.map((post) => (
                <BlogCard key={post.slug} post={post} />
              ))}
            </div>
          ) : null}

          {!isLoadingBlogs && !blogLoadError && visibleBlogs.length === 0 ? (
            <div className="rounded-[8px] border border-border bg-white p-8 text-center text-[14px] font-medium text-secondary/65">
              No blog posts are available in this category.
            </div>
          ) : null}

          {!isLoadingBlogs && !blogLoadError && visibleBlogs.length > 0 ? (
            <Pagination />
          ) : null}
        </div>

        <BlogSidebar
          categoryCounts={categoryCounts}
          onCategorySelect={setSelectedCategory}
          popularPosts={popularPosts}
          selectedCategory={selectedCategory}
        />
      </section>

    </main>
  );
}

function DetailHero({ post }: { post: PublicBlog }) {
  return (
    <section className="border-b border-border bg-[#fff8f0]">
      <div className="mx-auto flex min-h-[220px] w-full max-w-[1320px] flex-col justify-center px-4 py-7 sm:min-h-[250px] sm:px-5 sm:py-8 lg:min-h-[270px]">
        <div className="mb-5 sm:mb-6">
          <Breadcrumb current={post.title} />
        </div>
        <CategoryBadge category={post.category} />
        <h1 className="mt-4 max-w-[820px] font-heading text-[26px] font-bold leading-[1.14] tracking-normal text-secondary sm:text-[34px] lg:text-[40px]">
          {post.title}
        </h1>
        <div className="mt-5 flex flex-wrap items-center gap-4 text-[12px] font-medium text-secondary/75 sm:gap-5 sm:text-[13px]">
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="size-4" />
            {formatDate(post.publishedAt)}
          </span>
          <span className="size-1 rounded-full bg-secondary/45" />
          <span className="inline-flex items-center gap-2">
            <Clock3 className="size-4" />
            {post.readTimeMinutes} min read
          </span>
        </div>
      </div>
    </section>
  );
}

function ArticleHeroImage({ post }: { post: PublicBlog }) {
  return (
    <BlogImage
      image={getHeroImage(post)}
      label={post.title}
      className="mb-8 aspect-[16/8.2] w-full overflow-hidden rounded-[8px] border border-border shadow-[0_18px_42px_rgba(50,50,50,0.09)]"
    />
  );
}

type ArticleBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

const allowedArticleTags =
  "a|b|blockquote|br|div|em|figcaption|figure|h1|h2|h3|h4|i|img|li|ol|p|span|strong|u|ul";
const unsafeImageSourcePattern =
  /<img\b[^>]*\bsrc\s*=\s*(["'])(?!https?:|data:image\/(?:gif|jpe?g|png|webp);base64,|blob:|\/uploads\/)[\s\S]*?\1[^>]*>/gi;
const imageWithoutSourcePattern = /<img\b(?![^>]*\bsrc\s*=)[^>]*>/gi;

function isRichHtmlContent(content: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(content);
}

function hydrateArticleMediaUrls(html: string): string {
  return html.replace(
    /\s+src\s*=\s*(["'])(\/uploads\/[^"']+)\1/gi,
    (_match: string, quote: string, source: string) =>
      ` src=${quote}${getBlogMediaUrl(source)}${quote}`
  );
}

function sanitizeArticleHtml(html: string): string {
  return hydrateArticleMediaUrls(
    html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(unsafeImageSourcePattern, "")
    .replace(imageWithoutSourcePattern, "")
    .replace(
      /<\s*(script|style|iframe|object|embed|form|input|button|svg|math|meta|link)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      ""
    )
    .replace(
      /<\s*(script|style|iframe|object|embed|form|input|button|svg|math|meta|link)[^>]*\/?\s*>/gi,
      ""
    )
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(style|srcdoc)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+href\s*=\s*(["'])\s*javascript:[\s\S]*?\1/gi, "")
    .replace(
      new RegExp(`</?(?!(${allowedArticleTags})(?=\\s|/?>))[a-z][^>]*>`, "gi"),
      ""
    )
  );
}

function parseArticleContent(content: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({ type: "list", items: listItems });
      listItems = [];
    }
  };

  lines.forEach((line) => {
    if (line.startsWith("## ")) {
      flushList();
      blocks.push({ type: "heading", text: line.replace(/^##\s+/, "") });
      return;
    }

    if (line.startsWith("- ")) {
      listItems.push(line.replace(/^-\s+/, ""));
      return;
    }

    flushList();
    blocks.push({ type: "paragraph", text: line });
  });

  flushList();

  return blocks;
}

function ArticleBody({ post }: { post: PublicBlog }) {
  const hasRichContent = isRichHtmlContent(post.content);

  return (
    <div className="text-secondary">
      {hasRichContent ? (
        <div
          className={cn(
            "space-y-5 sm:space-y-6",
            "[&_a]:font-semibold [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4",
            "[&_blockquote]:rounded-[8px] [&_blockquote]:border [&_blockquote]:border-primary/35 [&_blockquote]:bg-primary/5 [&_blockquote]:px-5 [&_blockquote]:py-4 [&_blockquote]:text-[16px] [&_blockquote]:font-medium [&_blockquote]:italic [&_blockquote]:leading-[1.65] sm:[&_blockquote]:px-7 sm:[&_blockquote]:py-5 sm:[&_blockquote]:text-[18px]",
            "[&_div]:text-[16px] [&_div]:leading-[1.72] [&_div]:text-secondary sm:[&_div]:text-[18px]",
            "[&_figcaption]:text-center [&_figcaption]:text-[13px] [&_figcaption]:font-medium [&_figcaption]:leading-[1.55] [&_figcaption]:text-secondary/60 [&_figure]:space-y-2",
            "[&_h1]:font-heading [&_h1]:text-[30px] [&_h1]:font-bold [&_h1]:leading-[1.12] [&_h1]:tracking-normal [&_h1]:text-accent sm:[&_h1]:text-[38px]",
            "[&_h2]:font-heading [&_h2]:text-[24px] [&_h2]:font-bold [&_h2]:leading-[1.15] [&_h2]:tracking-normal [&_h2]:text-accent sm:[&_h2]:text-[28px]",
            "[&_h3]:font-heading [&_h3]:text-[21px] [&_h3]:font-bold [&_h3]:leading-[1.2] [&_h3]:tracking-normal [&_h3]:text-accent sm:[&_h3]:text-[23px]",
            "[&_img]:my-6 [&_img]:block [&_img]:h-auto [&_img]:max-h-[520px] [&_img]:w-full [&_img]:rounded-[8px] [&_img]:object-cover [&_img]:shadow-[0_14px_32px_rgba(50,50,50,0.08)]",
            "[&_li]:text-[15px] [&_li]:leading-[1.75] sm:[&_li]:text-[16px] [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 sm:[&_ol]:pl-6",
            "[&_p]:text-[16px] [&_p]:leading-[1.72] [&_p]:text-secondary sm:[&_p]:text-[18px]",
            "[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 sm:[&_ul]:pl-6"
          )}
          dangerouslySetInnerHTML={{
            __html: sanitizeArticleHtml(post.content),
          }}
        />
      ) : null}

      <div className={cn("space-y-5 sm:space-y-6", hasRichContent && "hidden")}>
        {parseArticleContent(post.content).map((block, index) => {
          if (block.type === "heading") {
            return (
              <h2
                key={`${block.type}-${index}`}
                className="font-heading text-[24px] font-bold leading-[1.15] tracking-normal text-accent sm:text-[28px]"
              >
                {block.text}
              </h2>
            );
          }

          if (block.type === "list") {
            return (
              <ul key={`${block.type}-${index}`} className="space-y-2">
                {block.items.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-[15px] leading-[1.75] text-secondary sm:text-[16px]"
                  >
                    <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            );
          }

          return (
            <p
              key={`${block.type}-${index}`}
              className="text-[16px] leading-[1.72] text-secondary sm:text-[18px]"
            >
              {block.text}
            </p>
          );
        })}
      </div>

      {post.quote ? (
        <blockquote className="mt-8 rounded-[8px] border border-primary/35 bg-primary/5 px-5 py-4 text-[16px] font-medium italic leading-[1.65] text-secondary sm:px-7 sm:py-5 sm:text-[18px]">
          <span className="mr-3 align-top font-heading text-[44px] font-bold leading-none text-primary">
            &ldquo;
          </span>
          {post.quote}
        </blockquote>
      ) : null}
    </div>
  );
}

function ShareRow() {
  const shareItems = [
    { label: "Share", icon: Send },
    { label: "X", icon: Share2 },
    { label: "Copy link", icon: Link2 },
    { label: "Email", icon: Mail },
  ];

  return (
    <div className="mt-7 flex flex-wrap items-center gap-3 border-b border-border pb-6">
      <span className="text-[13px] font-bold text-secondary">
        Share this blog:
      </span>
      {shareItems.map(({ icon: Icon, label }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          className="grid size-11 place-items-center rounded-full border border-border bg-white text-secondary transition-colors hover:border-primary hover:text-primary"
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}

function AdjacentPosts({
  nextPost,
  previousPost,
}: {
  nextPost?: PublicBlog;
  previousPost?: PublicBlog;
}) {
  return (
    <div className="mt-5 grid gap-4 rounded-[8px] border border-border bg-white p-3 sm:grid-cols-2">
      <AdjacentPostCard label="Previous Blog" post={previousPost} reverse />
      <AdjacentPostCard label="Next Blog" post={nextPost} />
    </div>
  );
}

function AdjacentPostCard({
  label,
  post,
  reverse = false,
}: {
  label: string;
  post?: PublicBlog;
  reverse?: boolean;
}) {
  if (!post) {
    return <div className="hidden sm:block" />;
  }

  const Icon = categoryIcons[post.category];
  const theme = getCategoryTheme(post.category);

  return (
    <Link
      href={`/blog/${post.slug}`}
      className={cn(
        "grid items-center gap-3 rounded-[6px] p-2 text-secondary transition-colors hover:bg-primary/5 hover:text-primary sm:grid-cols-[52px_minmax(0,1fr)]"
      )}
    >
      <span
        className={cn(
          "grid size-12 place-items-center rounded-[6px]",
          theme.icon,
          !reverse && "sm:order-2"
        )}
        aria-hidden="true"
      >
        <Icon className="size-4" />
      </span>
      <span className={cn("min-w-0", !reverse && "sm:text-right")}>
        <span className="flex items-center gap-1 text-[11px] font-medium text-secondary/60 sm:justify-start">
          {reverse ? <ChevronLeft className="size-3.5 text-primary" /> : null}
          {label}
          {!reverse ? <ChevronRight className="size-3.5 text-primary" /> : null}
        </span>
        <span className="mt-1 line-clamp-2 block font-heading text-[14px] font-bold leading-[1.25]">
          {post.title}
        </span>
      </span>
    </Link>
  );
}

export function BlogDetailPage({ slug }: { slug: string }) {
  const [post, setPost] = useState<PublicBlog | null>(null);
  const [blogs, setBlogs] = useState<PublicBlog[]>([]);
  const [popularPosts, setPopularPosts] = useState<PublicBlog[]>([]);
  const [categoryCounts, setCategoryCounts] =
    useState<BlogCategoryCount[]>(() => getCategoryCounts([]));
  const [isMissing, setIsMissing] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadDetail() {
      setIsLoadingDetail(true);
      setIsMissing(false);

      try {
        const [detailResponse, listResponse] = await Promise.all([
          getPublishedBlog(slug),
          listPublishedBlogs(),
        ]);
        const nextBlogs = listResponse.data.blogs;

        if (isMounted) {
          setPost(detailResponse.data.blog);
          setBlogs(nextBlogs);
          setPopularPosts(
            detailResponse.data.popularPosts.length
              ? detailResponse.data.popularPosts
              : getPopularPosts(nextBlogs)
          );
          setCategoryCounts(getCategoryCounts(nextBlogs, listResponse.data.categories));
          setIsMissing(false);
        }
      } catch {
        if (isMounted) {
          setPost(null);
          setBlogs([]);
          setPopularPosts([]);
          setCategoryCounts(getCategoryCounts([]));
          setIsMissing(true);
        }
      } finally {
        if (isMounted) {
          setIsLoadingDetail(false);
        }
      }
    }

    loadDetail();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const sortedBlogs = useMemo(() => getSortedBlogs(blogs, "Latest"), [blogs]);
  const currentIndex = post
    ? sortedBlogs.findIndex((blog) => blog.slug === post.slug)
    : -1;
  const previousPost =
    currentIndex >= 0
      ? sortedBlogs[currentIndex + 1] || sortedBlogs[currentIndex - 1]
      : undefined;
  const nextPost =
    currentIndex >= 0
      ? sortedBlogs[currentIndex + 2] || sortedBlogs[currentIndex - 1]
      : undefined;

  if (isLoadingDetail && !post) {
    return (
      <main className="min-h-screen bg-background text-secondary">
        <Header />
        <section className="mx-auto w-full max-w-[1320px] px-5 py-16">
          <Breadcrumb current="Loading blog" />
          <div className="mt-10 rounded-[8px] border border-border bg-white p-8 text-center shadow-[0_12px_34px_rgba(50,50,50,0.055)]">
            <h1 className="font-heading text-[34px] font-bold text-secondary">
              Loading blog...
            </h1>
          </div>
        </section>
      </main>
    );
  }

  if (isMissing || !post) {
    return (
      <main className="min-h-screen bg-background text-secondary">
        <Header />
        <section className="mx-auto w-full max-w-[1320px] px-5 py-16">
          <Breadcrumb current="Blog not found" />
          <div className="mt-10 rounded-[8px] border border-border bg-white p-8 text-center shadow-[0_12px_34px_rgba(50,50,50,0.055)]">
            <h1 className="font-heading text-[34px] font-bold text-secondary">
              Blog not found
            </h1>
            <p className="mt-3 text-[15px] text-secondary/70">
              The story you are looking for is not available.
            </p>
            <Link
              href="/blog"
              className="mt-6 inline-flex h-11 items-center rounded-[5px] bg-primary px-6 text-[13px] font-bold text-white"
            >
              Back to Blog
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-secondary">
      <Header />
      <DetailHero post={post} />

      <section className="mx-auto grid w-full max-w-[1320px] gap-8 px-4 py-8 sm:px-5 sm:py-10 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_330px]">
        <article className="min-w-0">
          <ArticleHeroImage post={post} />
          <ArticleBody post={post} />
          <ShareRow />
          <AdjacentPosts previousPost={previousPost} nextPost={nextPost} />
        </article>

        <BlogSidebar
          categoryCounts={categoryCounts}
          popularPosts={popularPosts}
        />
      </section>

    </main>
  );
}
