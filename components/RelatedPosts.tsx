// FILE: src/components/RelatedPosts.tsx

import Link from "next/link"
import { getAllPosts } from "@/lib/posts"
import type { Post } from "@/lib/posts" // ⭐️ تایپ Post را از lib ایمپورت کنید

// 1. تعریف پراپرتی‌هایی که کامپوننت دریافت می‌کند
// این کار خطای TypeScript را برطرف می‌کند
type RelatedPostsProps = {
  currentPostSlug: string
  category: string
}

// 2. کامپوننت شما باید این پراپرتی‌ها را بپذیرد
export default async function RelatedPosts({
  currentPostSlug,
  category
}: RelatedPostsProps) {
  // 3. منطق پیدا کردن مقالات مرتبط
  const allPosts = await getAllPosts()

  const relatedPosts = allPosts
    .filter(
      post =>
        // ✅ مقالاتی که در همین دسته‌بندی هستند
        post.category === category &&
        // ✅ و خود مقاله فعلی نباشند
        post.slug !== currentPostSlug
    )
    .slice(0, 3) // 👈 نمایش حداکثر ۳ مقاله مرتبط

  // اگر هیچ مقاله مرتبطی پیدا نشد
  if (relatedPosts.length === 0) {
    return (
      <div dir="rtl">
        <p className="text-gray-500">
          مقاله‌ی مرتبطی در این دسته‌بندی یافت نشد.
        </p>
      </div>
    )
  }

  // 4. نمایش مقالات مرتبط
  return (
    <div className="grid grid-cols-1 gap-6" dir="rtl">
      {relatedPosts.map(post => (
        <article
          key={post.slug}
          className="group rounded-lg border border-gray-800 bg-gray-900/50 p-4 transition-all hover:bg-gray-800/60"
        >
          <h3 className="mb-2 text-lg font-semibold text-white">
            <Link
              href={`/blog/${post.slug}`}
              className="transition-colors group-hover:text-blue-400"
            >
              {post.title}
            </Link>
          </h3>
          <p className="mb-3 text-sm text-gray-400">{post.excerpt}</p>
          <Link
            href={`/blog/${post.slug}`}
            className="text-sm font-medium text-blue-400"
          >
            ادامه مطلب...
          </Link>
        </article>
      ))}
    </div>
  )
}
