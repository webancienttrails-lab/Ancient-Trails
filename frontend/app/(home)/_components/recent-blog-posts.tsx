import Image from "next/image";
import Link from "next/link";
import { getBlogMediaUrl, type PublicBlogPreview } from "@/lib/blogs";
import { plainText } from "@/lib/seo";

export function RecentBlogPosts({ posts }: { posts: PublicBlogPreview[] }) {
  if (!posts.length) return null;
  return <section aria-labelledby="recent-blog-heading" className="bg-background py-10 sm:py-14">
    <div className="home-wide-frame mx-auto w-full px-5 sm:px-8 [@media(min-width:1300px)]:px-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h2 id="recent-blog-heading" className="font-heading text-[28px] font-bold text-secondary sm:text-[36px]">Stories from the trail</h2>
        <Link prefetch={false} href="/blog" className="font-sans text-sm font-semibold text-brand-text hover:underline">View all stories</Link>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {posts.map(post => <article key={post.id} className="overflow-hidden rounded-[10px] border border-border bg-white">
          <Link prefetch={false} href={`/blog/${encodeURIComponent(post.slug)}`} className="group block h-full focus-visible:outline-primary">
            {post.heroImage ? <div className="relative aspect-[16/9] overflow-hidden"><Image src={getBlogMediaUrl(post.heroImage)} alt={post.title} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-105" /></div> : null}
            <div className="p-5">
              <p className="font-sans text-xs font-semibold uppercase text-button-outline">{post.category}</p>
              <h3 className="mt-2 font-heading text-xl font-bold leading-snug text-secondary group-hover:text-brand-text">{post.title}</h3>
              {post.quote ? <p className="mt-3 line-clamp-3 font-sans text-sm leading-relaxed text-secondary/70">{plainText(post.quote)}</p> : null}
              <span className="mt-4 inline-block font-sans text-sm font-semibold text-brand-text">Read story →</span>
            </div>
          </Link>
        </article>)}
      </div>
    </div>
  </section>;
}
