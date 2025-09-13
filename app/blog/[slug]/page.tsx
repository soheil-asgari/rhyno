// FILE: app/blog/[slug]/page.tsx
import { getAllPosts, getPostBySlug } from "@/lib/posts"
import type { Metadata } from "next"
import { FiCalendar, FiUser } from "react-icons/fi"

// Props
type Props = {
  params: { slug: string }
}

// ✅ 1. متادیتای داینامیک برای هر مقاله
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPostBySlug(params.slug)
  const title = `${post.title} | بلاگ Rhyno AI`
  const description = post.excerpt || post.title
  const url = `https://rhynoai.ir/blog/${params.slug}`

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
      type: "article"
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    }
  }
}

// ✅ 2. ساخت صفحات استاتیک در زمان بیلد برای SEO
export async function generateStaticParams() {
  const posts = getAllPosts()
  return posts.map(post => ({
    slug: post.slug
  }))
}

// ✅ 3. صفحه اصلی هر مقاله
export default async function PostPage({ params }: Props) {
  const post = await getPostBySlug(params.slug)

  const postDate = post.date
    ? new Date(post.date).toLocaleDateString("fa-IR", {
        year: "numeric",
        month: "long",
        day: "numeric"
      })
    : new Date().toLocaleDateString("fa-IR")

  const authorName = post.author || "RhynoAI"

  return (
    <main className="font-vazir bg-background py-12 text-white sm:py-20">
      <article className="container mx-auto max-w-3xl px-4">
        {/* 🟢 هدر مقاله */}
        <header className="mb-8 border-b border-gray-800 pb-6 text-right">
          <h1 className="mb-4 text-3xl font-extrabold leading-snug">
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center justify-end gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <FiUser className="text-gray-500" />
              <span>{authorName}</span>
            </div>
            <div className="flex items-center gap-2">
              <FiCalendar className="text-gray-500" />
              <time dateTime={post.date || new Date().toISOString()}>
                {postDate}
              </time>
            </div>
          </div>
        </header>

        {/* 🟢 محتوای مقاله */}
        <div
          className="prose prose-invert prose-base prose-p:leading-relaxed prose-a:text-blue-400 max-w-none text-right"
          dir="rtl"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />

        {/* 🟢 JSON-LD Schema */}
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
              }
            })
          }}
        />
      </article>
    </main>
  )
}
