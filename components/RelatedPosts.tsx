// FILE: components/RelatedPosts.tsx
import Link from "next/link"

type RelatedPost = {
  slug: string
  title: string
}

interface Props {
  related?: RelatedPost[]
}

export default function RelatedPosts({ related }: Props) {
  if (!related || related.length === 0) return null

  return (
    <section className="mt-12 border-t border-gray-700 pt-6">
      <h3 className="mb-4 text-xl font-semibold text-white">مقالات مرتبط</h3>
      <ul className="list-inside list-disc text-blue-400">
        {related.map(post => (
          <li key={post.slug}>
            <Link href={`/blog/${post.slug}`}>{post.title}</Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
