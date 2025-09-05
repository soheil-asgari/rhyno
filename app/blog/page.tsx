// app/blog/page.tsx

import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { FiArrowLeft, FiCalendar, FiUser } from "react-icons/fi"
import { getAllPosts } from "@/lib/posts"

// 💡 نوع مشخص برای داده‌های پست
type Post = {
  slug: string
  title: string
  date: string
  author: string
  image: string
  excerpt: string
  category: string
}
export const metadata: Metadata = {
  title: "بلاگ هوش مصنوعی Rhyno AI | مقالات، آموزش‌ها و اخبار AI",
  description:
    "جدیدترین تحلیل‌ها، آموزش‌ها و اخبار دنیای هوش مصنوعی را در بلاگ Rhyno AI دنبال کنید.",
  robots: "index, follow",
  alternates: {
    canonical: "https://yourdomain.com/blog"
  }
}
// کامپوننت کارت مقاله با RTL و اندازه تصویر مناسب
const BlogCard = ({ post }: { post: Post }) => {
  const postDate = post.date
    ? new Date(post.date).toLocaleDateString("fa-IR", {
        year: "numeric",
        month: "long",
        day: "numeric"
      })
    : new Date().toLocaleDateString("fa-IR")

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-gray-800 bg-gray-900/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-900/20">
      <Link href={`/blog/${post.slug}`} className="block overflow-hidden">
        <Image
          src={post.image || "/rhyno1.png"}
          alt={`تصویر مقاله ${post.title}`}
          width={400}
          height={250}
          className="h-48 w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </Link>
      <div className="flex flex-1 flex-col p-5" dir="rtl">
        {post.category && (
          <span className="mb-3 rounded-full bg-blue-600/20 px-3 py-1 text-xs font-semibold text-blue-400">
            {post.category}
          </span>
        )}
        <h3 className="mb-2 text-lg font-semibold text-white">
          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
        </h3>
        <p className="flex-1 text-sm text-gray-400">{post.excerpt || ""}</p>
        <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <FiUser />
            <span>{post.author || "RhynoAI"}</span>
          </div>
          <div className="flex items-center gap-2">
            <FiCalendar />
            <time dateTime={post.date || new Date().toISOString()}>
              {postDate}
            </time>
          </div>
        </div>
      </div>
    </article>
  )
}

export default function BlogPage() {
  const allPosts: Post[] = getAllPosts()

  if (allPosts.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center text-white">
        <p>هنوز مقاله‌ای منتشر نشده است.</p>
      </div>
    )
  }

  const featuredPost = allPosts[0]
  const otherPosts = allPosts.slice(1)

  const featuredTitle =
    featuredPost.title.length > 30
      ? featuredPost.title.slice(0, 30) + "..."
      : featuredPost.title

  return (
    <div className="font-vazir bg-background min-h-screen w-full overflow-x-hidden text-gray-300">
      <main className="container mx-auto px-4 py-12 md:py-20">
        {/* Hero Section */}
        <header className="mb-12 text-center">
          <h1 className="mb-3 text-4xl font-extrabold text-white md:text-5xl">
            بلاگ هوش مصنوعی Rhyno AI
          </h1>
          <p className="mx-auto max-w-2xl text-gray-400">
            جدیدترین تحلیل‌ها، آموزش‌ها و اخبار دنیای هوش مصنوعی را اینجا دنبال
            کنید.
          </p>
        </header>

        {/* Featured Post Section */}
        <section className="mb-16">
          <article className="group grid grid-cols-1 items-center gap-8 rounded-2xl border border-gray-800 bg-gray-900/50 p-6 transition-all duration-300 hover:bg-gray-800/60 md:grid-cols-2">
            <Link
              href={`/blog/${featuredPost.slug}`}
              className="block overflow-hidden rounded-lg"
            >
              <Image
                src={featuredPost.image || "/rhyno1.png"}
                alt={`تصویر مقاله ویژه: ${featuredPost.title}`}
                width={400}
                height={250}
                className="h-48 w-full rounded-lg object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </Link>
            <div dir="rtl">
              <span className="mb-3 inline-block rounded-full bg-amber-500/20 px-3 py-1 text-sm font-semibold text-amber-400">
                {featuredTitle}
              </span>
              <h2 className="mb-3 text-xl font-semibold text-white hover:text-blue-400 md:text-2xl">
                <Link href={`/blog/${featuredPost.slug}`}>
                  {featuredPost.title}
                </Link>
              </h2>
              <p className="mb-5 text-gray-400">{featuredPost.excerpt || ""}</p>
              <Link
                href={`/blog/${featuredPost.slug}`}
                className="group flex items-center font-semibold text-blue-400"
              >
                <span>ادامه مطلب</span>
                <FiArrowLeft className="mr-2 transition-transform duration-300 group-hover:-translate-x-1" />
              </Link>
            </div>
          </article>
        </section>

        {/* All Posts Grid */}
        {otherPosts.length > 0 && (
          <section>
            <h2 className="mb-8 text-center text-3xl font-bold text-white">
              آخرین مقالات
            </h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {otherPosts.map(post => (
                <BlogCard key={post.slug} post={post} />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* اسکیمای JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Blog",
            name: "بلاگ هوش مصنوعی Rhyno AI"
          })
        }}
      />
    </div>
  )
}
