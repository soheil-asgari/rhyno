import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import type { Metadata } from "next"
import { FiCalendar, FiUser } from "react-icons/fi"
import { ViewDisplay } from "./components/ViewDisplay"

// ایمپورت‌های پروژه شما
import { getPostBySlug, getLocalPosts } from "@/lib/posts" // مطمئن شوید این توابع fetch به upstash ندارند
import RelatedPosts from "@/components/RelatedPosts"
import { ViewCounter } from "./components/ViewCounter"

type Props = {
  params: { slug: string }
}

// ✅ ساخت صفحات استاتیک (این بخش باعث سرعت بالا می‌شود)
// export async function generateStaticParams() {
//   const posts = getLocalPosts()
//   return posts.map(post => ({ slug: post.slug }))
// }

// ✅ متادیتا
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPostBySlug(params.slug)

  if (!post) {
    return { title: "پست یافت نشد | بلاگ Rhyno AI" }
  }

  const title = `${post.title} | بلاگ Rhyno AI`
  const description = post.excerpt || post.title
  const url = `https://rhynoai.ir/blog/${params.slug}`
  const image = post.image || "https://rhynoai.ir/default-blog.jpg"

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Rhyno AI",
      locale: "fa_IR",
      type: "article",
      images: [{ url: image, width: 1200, height: 630, alt: post.title }]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image]
    }
  }
}

// ✅ کامپوننت اصلی صفحه
export default async function PostPage({ params }: Props) {
  // اگر getPostBySlug درخواست fetch به Upstash می‌فرستد، باید آن را از داخل تابع حذف کنید
  const post = await getPostBySlug(params.slug)

  if (!post) {
    notFound()
  }

  const postDate = post.date
    ? new Date(post.date).toLocaleDateString("fa-IR", {
        year: "numeric",
        month: "long",
        day: "numeric"
      })
    : new Date().toLocaleDateString("fa-IR")

  const authorName = post.author || "RhynoAI"
  const image = post.image || "https://rhynoai.ir/default-blog.jpg"

  return (
    <main className="font-vazir bg-background py-12 text-gray-900 sm:py-20 dark:text-white">
      {/* کامپوننت کلاینت برای ثبت بازدید */}
      <ViewCounter slug={post.slug} />

      <article className="container mx-auto max-w-3xl px-4">
        {/* هدر */}
        <header className="mb-8 border-b border-gray-200 pb-6 text-right dark:border-gray-800">
          <h1 className="mb-4 text-3xl font-extrabold leading-snug">
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center justify-end gap-6 text-sm text-gray-600 dark:text-gray-400">
            <ViewDisplay slug={post.slug} />
            <div className="flex items-center gap-2">
              <FiUser className="text-gray-600 dark:text-gray-500" />
              <span>{authorName}</span>
            </div>
            <div className="flex items-center gap-2">
              <FiCalendar className="text-gray-600 dark:text-gray-500" />
              <time dateTime={post.date || new Date().toISOString()}>
                {postDate}
              </time>
            </div>
            {post.category && (
              <div>
                <Link
                  href={`/blog/category/${post.category}`}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {post.category}
                </Link>
              </div>
            )}
          </div>
          {image && (
            <div className="relative mt-4 h-[250px] w-full sm:h-[400px]">
              <Image
                src={image}
                alt={post.title}
                fill
                className="rounded-lg object-cover"
                priority
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 800px"
              />
            </div>
          )}
        </header>

        {/* محتوا */}
        <div
          className="prose prose-base dark:prose-invert prose-p:leading-relaxed prose-a:text-blue-600 dark:prose-a:text-blue-400 max-w-none text-right"
          dir="rtl"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />

        {/* اسکیما */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BlogPosting",
              headline: post.title,
              description: post.excerpt || "",
              datePublished: post.date || new Date().toISOString(),
              author: {
                "@type": "Person",
                name: authorName
              },
              image,
              mainEntityOfPage: {
                "@type": "WebPage",
                "@id": `https://rhynoai.ir/blog/${post.slug}`
              }
            })
          }}
        />
      </article>

      {/* مقالات مرتبط */}
      <section className="container mx-auto mt-12 max-w-3xl border-t border-gray-200 px-4 pt-8 text-right dark:border-gray-800">
        <h2 className="mb-6 text-2xl font-bold">مقالات مرتبط</h2>
        <RelatedPosts currentPostSlug={post.slug} category={post.category} />
      </section>
    </main>
  )
}
