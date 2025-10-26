// FILE: app/blog/page.tsx

import type { Metadata } from "next"
import Link from "next/link"
import { FiArrowLeft, FiCalendar, FiUser, FiEye } from "react-icons/fi"
import { getAllPosts, type Post } from "@/lib/posts"

// Metadata (عالی، بدون تغییر)
export const metadata: Metadata = {
  title: "بلاگ هوش مصنوعی Rhyno AI | مقالات، آموزش‌ها و اخبار AI",
  description:
    "جدیدترین تحلیل‌ها، آموزش‌ها و اخبار دنیای هوش مصنوعی را در بلاگ Rhyno AI دنبال کنید.",
  keywords: [
    "بلاگ هوش مصنوعی",
    "مقالات AI",
    "آموزش هوش مصنوعی",
    "اخبار AI",
    "Rhyno AI"
  ],
  robots: "index, follow",
  alternates: {
    canonical: "https://rhynoai.ir/blog"
  },
  openGraph: {
    title: "بلاگ هوش مصنوعی Rhyno AI",
    description:
      "تحلیل‌ها، آموزش‌ها و جدیدترین اخبار دنیای هوش مصنوعی – بلاگ Rhyno AI",
    url: "https://rhynoai.ir/blog",
    siteName: "Rhyno AI",
    locale: "fa_IR",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "بلاگ هوش مصنوعی Rhyno AI",
    description: "تحلیل‌ها، آموزش‌ها و اخبار AI در Rhyno AI"
  }
}

const BlogCard = ({ post }: { post: Post }) => {
  const postDate = post.date
    ? new Date(post.date).toLocaleDateString("fa-IR", {
        year: "numeric",
        month: "long",
        day: "numeric"
      })
    : new Date().toLocaleDateString("fa-IR")

  return (
    <article
      className="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900/50 dark:hover:shadow-2xl dark:hover:shadow-blue-900/20"
      itemScope
      itemType="https://schema.org/BlogPosting"
    >
      <div className="flex flex-col" dir="rtl">
        {post.category && (
          <span className="mb-2 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-600/20 dark:text-blue-400">
            {post.category}
          </span>
        )}

        {post.image && (
          <img
            src={post.image}
            alt={post.title}
            className="mb-3 w-full rounded-lg object-cover"
            loading="lazy"
          />
        )}

        <h3
          className="mb-2 text-lg font-semibold text-gray-900 dark:text-white"
          itemProp="headline"
        >
          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
        </h3>

        <p
          className="flex-1 text-sm text-gray-600 dark:text-gray-400"
          itemProp="description"
        >
          {post.excerpt || ""}
        </p>

        <div className="mt-4 flex items-center justify-start gap-6 text-xs text-gray-500 dark:text-gray-500">
          {/* 1. Author */}
          <div className="flex items-center gap-2">
            <FiUser />
            <span itemProp="author">{post.author || "RhynoAI"}</span>
          </div>

          {/* 2. Date */}
          <div className="flex items-center gap-2">
            <FiCalendar />
            <time
              dateTime={post.date || new Date().toISOString()}
              itemProp="datePublished"
            >
              {postDate}
            </time>
          </div>

          {/* 3. Views (جدید) */}
          {post.views >= 0 && (
            <div className="flex items-center gap-2">
              <FiEye />
              <span>{post.views}</span>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

export default async function BlogPage() {
  const allPosts: Post[] = await getAllPosts()

  if (allPosts.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-900 dark:text-white">
        <p>هنوز مقاله‌ای منتشر نشده است.</p>
      </div>
    )
  }

  const featuredPost = allPosts[0]
  const otherPosts = allPosts.slice(1)

  return (
    <div className="font-vazir bg-background min-h-screen w-full overflow-x-hidden text-gray-900 dark:text-gray-300">
      <main className="container mx-auto px-4 py-12 md:py-20">
        {/* Hero Section */}
        <header className="mb-12 text-center">
          <h1 className="mb-3 text-4xl font-extrabold text-gray-900 md:text-5xl dark:text-white">
            بلاگ هوش مصنوعی Rhyno AI
          </h1>

          <p className="mx-auto max-w-2xl text-gray-600 dark:text-gray-400">
            جدیدترین تحلیل‌ها، آموزش‌ها و اخبار دنیای هوش مصنوعی را اینجا دنبال
            کنید.
          </p>
        </header>

        {/* Featured Post */}
        <section className="mb-16">
          <article className="group rounded-2xl border border-gray-200 bg-gray-50 p-6 transition-all duration-300 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900/50 dark:hover:bg-gray-800/60">
            <div dir="rtl" itemScope itemType="https://schema.org/BlogPosting">
              {featuredPost.category && (
                <span className="mb-3 inline-block rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                  {featuredPost.category}
                </span>
              )}

              {featuredPost.image && (
                <img
                  src={featuredPost.image}
                  alt={featuredPost.title}
                  className="mb-3 w-full rounded-lg object-cover"
                  loading="lazy"
                />
              )}

              <h2
                className="mb-3 text-xl font-semibold text-gray-900 hover:text-blue-600 md:text-2xl dark:text-white dark:hover:text-blue-400"
                itemProp="headline"
              >
                <Link href={`/blog/${featuredPost.slug}`}>
                  {featuredPost.title || "مقاله بدون عنوان"}
                </Link>
              </h2>

              <p
                className="mb-5 text-gray-600 dark:text-gray-400"
                itemProp="description"
              >
                {featuredPost.excerpt || ""}
              </p>

              <Link
                href={`/blog/${featuredPost.slug}`}
                className="group flex items-center font-semibold text-blue-600 dark:text-blue-400"
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
            <h2 className="mb-8 text-center text-3xl font-bold text-gray-900 dark:text-white">
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
    </div>
  )
}
