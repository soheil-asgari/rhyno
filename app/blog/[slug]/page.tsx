// FILE: app/blog/[slug]/page.tsx

import { getAllPosts, getPostBySlug } from "@/lib/posts"
import type { Metadata } from "next"
import Link from "next/link"
import { FiCalendar, FiUser } from "react-icons/fi"
import RelatedPosts from "@/components/RelatedPosts"
import Image from "next/image"
// ⭐️ ۱. ایمپورت‌های مورد نیاز برای شمارنده و 404
import { notFound } from "next/navigation"
import { ViewCounter } from "./components/ViewCounter" // (مسیر را بر اساس ساختار پروژه خود تنظیم کنید)
import { getLocalPosts } from "@/lib/posts"

// Props
type Props = {
  params: { slug: string }
}

// ✅ Metadata داینامیک
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPostBySlug(params.slug)

  // ⭐️ ۲. مدیریت 404 در متادیتا
  if (!post) {
    return {
      title: "پست یافت نشد | بلاگ Rhyno AI"
    }
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
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: post.title
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image]
    }
  }
}

// ✅ ساخت صفحات استاتیک
export async function generateStaticParams() {
  // ⭐️ "await" را اینجا اضافه کنید
  const posts = getLocalPosts()
  return posts.map(post => ({ slug: post.slug }))
}

// ✅ صفحه مقاله بهینه
export default async function PostPage({ params }: Props) {
  const post = await getPostBySlug(params.slug)

  // ⭐️ ۳. مدیریت 404 برای صفحه
  if (!post) {
    notFound()
  }

  // (این متغیرها باید بعد از چک 404 باشند)
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
    // 🟢 تغییر یافته: رنگ متن پیش‌فرض (لایت) و رنگ دارک مود
    <main className="font-vazir bg-background py-12 text-gray-900 sm:py-20 dark:text-white">
      {/* ⭐️ ۴. اضافه کردن شمارنده بازدید */}
      <ViewCounter slug={post.slug} />

      <article className="container mx-auto max-w-3xl px-4">
        {/* 🟢 هدر مقاله (تغییر یافته) */}
        {/* 🟢 تغییر یافته: رنگ border برای لایت و دارک مود */}
        <header className="mb-8 border-b border-gray-200 pb-6 text-right dark:border-gray-800">
          <h1 className="mb-4 text-3xl font-extrabold leading-snug">
            {post.title}
          </h1>
          {/* 🟢 تغییر یافته: رنگ متن متا (نویسنده و تاریخ) برای لایت و دارک */}
          <div className="flex flex-wrap items-center justify-end gap-6 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              {/* 🟢 تغییر یافته: رنگ آیکون‌ها برای لایت و دارک */}
              <FiUser className="text-gray-600 dark:text-gray-500" />
              <span>{authorName}</span>
            </div>
            <div className="flex items-center gap-2">
              {/* 🟢 تغییر یافته: رنگ آیکون‌ها برای لایت و دارک */}
              <FiCalendar className="text-gray-600 dark:text-gray-500" />
              <time dateTime={post.date || new Date().toISOString()}>
                {postDate}
              </time>
            </div>
            {post.category && (
              <div>
                <Link
                  href={`/blog/category/${post.category}`}
                  // 🟢 تغییر یافته: رنگ لینک برای لایت و دارک مود
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {post.category}
                </Link>
              </div>
            )}
          </div>
          {image && (
            <div className="relative mt-4 h-[400px] w-full">
              {" "}
              {/* ارتفاع باید متناسب باشد */}
              <Image
                src={image}
                alt={post.title}
                fill
                className="rounded-lg object-cover"
                priority // چون بالای صفحه است و LCP حساب می‌شود
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </div>
          )}
        </header>

        {/* 🟢 محتوای مقاله (تغییر یافته) */}
        {/*
          🟢 مهم‌ترین تغییر:
          1. 'prose-invert' حذف شد تا پیش‌فرض لایت باشد.
          2. 'dark:prose-invert' اضافه شد تا فقط در دارک مود متن‌ها سفید شوند.
          3. 'prose-a:text-blue-600' برای رنگ لینک لایت مود اضافه شد.
          4. 'dark:prose-a:text-blue-400' برای رنگ لینک دارک مود حفظ شد.
        */}
        <div
          className="prose dark:prose-invert prose-base prose-p:leading-relaxed prose-a:text-blue-600 dark:prose-a:text-blue-400 max-w-none text-right"
          dir="rtl"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />

        {/* 🟢 JSON-LD (عالی، بدون تغییر) */}
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
              publisher: {
                "@type": "Organization",
                name: "Rhyno AI",
                logo: {
                  "@type": "ImageObject",
                  url: "https://rhynoai.ir/rhyno_white.png"
                }
              },
              mainEntityOfPage: {
                "@type": "WebPage",
                "@id": `https://rhynoai.ir/blog/${post.slug}`
              },
              breadcrumb: {
                "@type": "BreadcrumbList",
                itemListElement: [
                  {
                    "@type": "ListItem",
                    position: 1,
                    name: "خانه",
                    item: "https://rhynoai.ir"
                  },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: "بلاگ",
                    item: "https://rhynoai.ir/blog"
                  },
                  {
                    "@type": "ListItem",
                    position: 3,
                    name: post.title
                  }
                ]
              }
            })
          }}
        />
      </article>

      {/* ⭐️ ۵. استفاده از کامپوننت مقالات مرتبط */}
      {/* 🟢 تغییر یافته: رنگ border برای لایت و دارک مود */}
      <section className="container mx-auto mt-12 max-w-3xl border-t border-gray-200 px-4 pt-8 text-right dark:border-gray-800">
        {/* 🟢 تغییر یافته: 'text-white' حذف شد تا از <main> ارث‌بری کند */}
        <h2 className="mb-6 text-2xl font-bold">مقالات مرتبط</h2>
        <RelatedPosts currentPostSlug={post.slug} category={post.category} />
      </section>
    </main>
  )
}
