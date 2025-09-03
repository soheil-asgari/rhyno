// app/blog/[slug]/page.tsx
import { getAllPosts, getPostBySlug } from "@/lib/posts"
import type { Metadata } from "next"
import Image from "next/image"
import { FiCalendar, FiUser } from "react-icons/fi"

// Props
type Props = {
  params: { slug: string }
}

// 💡 ۱. ساخت متادیتای داینامیک برای SEO هر صفحه
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPostBySlug(params.slug)
  return {
    title: `${post.title} | Rhyno AI Blog`,
    description: post.excerpt || post.title
  }
}

// 💡 ۲. ساخت صفحات استاتیک در زمان بیلد برای سرعت و SEO
export async function generateStaticParams() {
  const posts = getAllPosts()
  return posts.map(post => ({
    slug: post.slug
  }))
}

// کامپوننت اصلی صفحه مقاله
export default async function PostPage({ params }: Props) {
  const post = await getPostBySlug(params.slug)

  // fallback برای تاریخ و author
  const postDate = post.date
    ? new Date(post.date).toLocaleDateString("fa-IR")
    : new Date().toLocaleDateString("fa-IR")
  const authorName = post.author || "RhynoAI"
  const imageUrl = post.image || "/rhyno1.png"

  return (
    <main className="font-vazir bg-background py-12 text-white sm:py-20">
      <article className="container mx-auto max-w-3xl px-4">
        {/* هدر مقاله */}
        <header className="mb-8 flex flex-col items-end border-b border-gray-800 pb-6">
          <h1 className="mb-4 whitespace-nowrap text-right text-3xl font-extrabold">
            {post.title}
          </h1>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <FiUser />
              <span>{authorName}</span>
            </div>
            <div className="flex items-center gap-2">
              <FiCalendar />
              <time dateTime={post.date || new Date().toISOString()}>
                {postDate}
              </time>
            </div>
          </div>
        </header>

        {/* تصویر اصلی مقاله */}
        <div className="mx-auto my-8 w-80 overflow-hidden rounded-xl">
          <Image
            src={imageUrl}
            alt={post.title}
            width={320} // عرض واقعی تصویر
            height={180} // ارتفاع واقعی تصویر
            className="rounded-xl object-cover"
          />
        </div>

        {/* محتوای مقاله */}
        <div
          className="prose prose-invert prose-lg prose-p:leading-relaxed prose-a:text-blue-400 max-w-none text-right text-base"
          dir="rtl"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />

        {/* 💡 ۳. اسکیمای JSON-LD برای هر مقاله */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BlogPosting",
              headline: post.title,
              datePublished: post.date || new Date().toISOString(),
              author: {
                "@type": "Person",
                name: authorName
              },
              image: `https://rhynoai.ir${imageUrl}`
            })
          }}
        />
      </article>
    </main>
  )
}
