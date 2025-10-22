import React, { FC, ElementType } from "react"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
// ✨ [تصحیح] تایپ صحیح از 'react-markdown' ایمپورت شد
import { Options } from "react-markdown"
import { MessageCodeBlock } from "./message-codeblock"
import { MessageMarkdownMemoized } from "./message-markdown-memoized"
import { cn } from "@/lib/utils"

interface MessageMarkdownProps extends React.HTMLAttributes<HTMLDivElement> {
  content: string
  className?: string
  dir?: "rtl" | "ltr"
  // ✨ [تصحیح] از تایپ 'Options' استفاده می‌کنیم
  components?: Options["components"]
}

export const MessageMarkdown: FC<MessageMarkdownProps> = ({
  content,
  className = "",
  dir = "ltr",
  style,
  components // <-- این پراپ حالا تایپ صحیح را دارد
}) => {
  const cleanedContent = content.replace(/\n{2,}/g, "\n")

  // ✨ [تصحیح] تایپ کامپوننت‌های پیش‌فرض را 'Options["components"]' قرار می‌دهیم
  // این کار خطاهای "implicit any" را برطرف می‌کند
  const defaultComponents: Options["components"] = {
    p({ node, children, ...props }) {
      // <-- امضای تابع برای مطابقت با تایپ به‌روز شد
      return (
        <p className="mb-0 leading-relaxed last:mb-0" {...props}>
          {children}
        </p>
      )
    },

    img({ node, ...props }) {
      return (
        <a
          href={props.src}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="mx-auto block"
        >
          <img
            {...props}
            className="w-full max-w-screen-lg cursor-pointer rounded-lg shadow-lg transition-transform duration-200 hover:scale-105 sm:max-w-screen-md md:max-w-[896px] lg:max-w-screen-lg"
            alt={props.alt || "Generated image"}
          />
        </a>
      )
    },

    code({ node, className, children, ...props }) {
      // تایپ‌دهی صریح در بالا، خطاهای "implicit any" اینجا را حل می‌کند
      const childArray = React.Children.toArray(children)
      const firstChild = childArray[0] as React.ReactElement
      const firstChildAsString = React.isValidElement(firstChild)
        ? (firstChild as React.ReactElement).props.children
        : firstChild

      if (firstChildAsString === "▍") {
        return <span className="mt-1 animate-pulse cursor-default">▍</span>
      }

      if (typeof firstChildAsString === "string") {
        childArray[0] = firstChildAsString.replace("`▍`", "▍")
      }

      const match = /language-(\w+)/.exec(className || "")

      if (
        typeof firstChildAsString === "string" &&
        !firstChildAsString.includes("\n")
      ) {
        return (
          <code className={className} {...props}>
            {childArray}
          </code>
        )
      }

      return (
        <MessageCodeBlock
          key={Math.random()}
          language={(match && match[1]) || ""}
          value={String(childArray).replace(/\n$/, "")}
          {...props}
        />
      )
    }
  }

  // ✨ [تصحیHح] تایپ صریح برای کامپوننت‌های ادغام‌شده
  const mergedComponents: Options["components"] = {
    ...defaultComponents,
    ...components // رندر تگ 'a' سفارشی شما اینجا ادغام می‌شود
  }

  return (
    <div
      dir={dir}
      className={cn(
        "w-full",
        "scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-400 max-h-[70vh] overflow-y-auto",
        "sm:max-h-full sm:overflow-visible",
        className
      )}
      style={style}
    >
      <MessageMarkdownMemoized
        className={cn(
          "chat-markdown-content font-vazir min-w-full break-words"
        )}
        remarkPlugins={[remarkGfm, remarkMath]}
        components={mergedComponents} // <-- این حالا تایپ صحیح را دارد
      >
        {cleanedContent}
      </MessageMarkdownMemoized>
    </div>
  )
}
