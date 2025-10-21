import { getAllPosts, type Post } from "@/lib/posts"
import Link from "next/link"
import Image from "next/image" // ⭐️ 1. ایمپورت کردن کامپوننت Image
import { FiCalendar, FiUser, FiEye } from "react-icons/fi"

// =======================================================================
//  BlogCard component
// =======================================================================
const BlogCard = ({ post }: { post: Post }) => {
  const postDate = new Date(post.date).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric"
  })

  return (
    <article
      className="group flex flex-col rounded-xl border border-gray-800 bg-gray-900/50 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-900/20"
      itemScope
      itemType="https://schema.org/BlogPosting"
    >
      <div className="flex flex-col" dir="rtl">
        {post.image && (
          <Link
            href={`/blog/${post.slug}`}
            className="mb-4 block overflow-hidden rounded-lg"
          >
            {/* ⭐️ 2. جایگزینی تگ img با کامپوننت Image */}
            <Image
              src={post.image}
              alt={post.title}
              width={500}
              height={281}
              className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </Link>
        )}
        <h3
          className="mb-3 text-lg font-semibold text-white"
          itemProp="headline"
        >
          <Link href={`/blog/${post.slug}`} className="hover:text-blue-400">
            {post.title}
          </Link>
        </h3>
        <p className="flex-1 text-sm text-gray-400" itemProp="description">
          {post.excerpt || ""}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-start gap-x-6 gap-y-2 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <FiUser />
            <span itemProp="author">{post.author || "RhynoAI"}</span>
          </div>
          <div className="flex items-center gap-2">
            <FiCalendar />
            <time dateTime={post.date} itemProp="datePublished">
              {postDate}
            </time>
          </div>
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

// =======================================================================
// کامپوننت اصلی صفحه دسته‌بندی
// =======================================================================
type Props = {
  params: {
    slug: string
  }
}

export async function generateStaticParams() {
  const posts = await getAllPosts()
  const categories = [...new Set(posts.map(post => post.category))]
  return categories.map(category => ({
    slug: category
  }))
}

export default async function CategoryPage({ params }: Props) {
  const categoryName = decodeURIComponent(params.slug)
  const allPosts = await getAllPosts()
  const filteredPosts = allPosts.filter(
    post => post.category.toLowerCase() === categoryName.toLowerCase()
  )

  if (filteredPosts.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center text-center text-white">
        <h1 className="mb-4 text-3xl font-bold">
          {/* ⭐️ 3. اصلاح کردن گیومه‌ها برای رفع خطا */}
          مقاله‌ای در دسته‌بندی «{categoryName}» یافت نشد.
        </h1>
        <Link href="/blog" className="text-blue-400 hover:underline">
          بازگشت به لیست تمام مقالات
        </Link>
      </div>
    )
  }

  return (
    <div className="font-vazir bg-background min-h-screen w-full overflow-x-hidden text-gray-300">
      <main className="container mx-auto px-4 py-12 md:py-20">
        <header className="mb-12 text-center">
          <p className="mb-2 text-lg text-blue-400">نمایش مقالات برای</p>
          <h1 className="text-4xl font-extrabold text-white md:text-5xl">
            دسته‌بندی: {categoryName}
          </h1>
        </header>
        <section>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {filteredPosts.map(post => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
