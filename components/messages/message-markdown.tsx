import React, { FC, ElementType, useMemo } from "react"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import { Options } from "react-markdown"
import { MessageCodeBlock } from "./message-codeblock"
import { MessageMarkdownMemoized } from "./message-markdown-memoized"
import { cn } from "@/lib/utils"

interface MessageMarkdownProps extends React.HTMLAttributes<HTMLDivElement> {
  content: string
  className?: string
  dir?: "rtl" | "ltr"
  components?: Options["components"]
}

export const MessageMarkdown: FC<MessageMarkdownProps> = ({
  content,
  className = "",
  dir = "ltr",
  style,
  components
}) => {
  const cleanedContent = content.replace(/\\n{2,}/g, "\\n")

  const defaultComponents: Options["components"] = {
    p({ node, children, ...props }) {
      return (
        <p className="mb-0 leading-relaxed last:mb-0" {...props}>
          {children}
        </p>
      )
    },

    img({ node, ...props }) {
      // @ts-ignore
      // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
      return <img className="max-w-full rounded-lg" {...props} />
    },

    ol({ node, children, ...props }) {
      return (
        <ol
          className={`markdown-content-rtl list-outside list-decimal ${dir === "rtl" ? "mr-4" : "ml-4"}`}
          {...props}
        >
          {children}
        </ol>
      )
    },

    ul({ node, children, ...props }) {
      return (
        <ul
          className={`list-outside list-disc ${dir === "rtl" ? "mr-4" : "ml-4"}`}
          {...props}
        >
          {children}
        </ul>
      )
    },

    li({ node, children, ...props }) {
      return (
        <li className="mb-1" {...props}>
          {children}
        </li>
      )
    },

    // 👇 ==== اصلاح ارور TypeScript از اینجا شروع می‌شود ==== 👇
    code({ node, className, children, ...props }) {
      const childArray = React.Children.toArray(children)

      // 1. FIX: کست ناامن 'as React.ReactElement' حذف شد
      const firstChild = childArray[0] // نوع این 'ReactNode' است

      let firstChildAsString: string

      // 2. FIX: از 'React.isValidElement' به عنوان type guard استفاده می‌کنیم
      if (React.isValidElement(firstChild)) {
        firstChildAsString = String(firstChild.props.children)
      } else {
        // در غیر این صورت (اگر فقط متن خام باشد)
        firstChildAsString = String(children)
      }

      if (firstChildAsString === "▍") {
        return <span className="mt-1 animate-pulse cursor-default">▍</span>
      }

      // 3. FIX: از 'firstChildAsString' پاک شده استفاده می‌کنیم
      // (منطق قبلی که 'childArray[0]' را تغییر می‌داد، شکننده بود)
      const cleanedContent = firstChildAsString.replace("`▍`", "▍")

      const match = /language-(\w+)/.exec(className || "")

      if (
        typeof cleanedContent === "string" &&
        !cleanedContent.includes("\n")
      ) {
        return (
          <code className={className} {...props}>
            {cleanedContent}
          </code>
        )
      }

      return (
        <MessageCodeBlock
          key={Math.random()}
          language={(match && match[1]) || ""}
          value={String(cleanedContent).replace(/\\n$/, "")}
          {...props}
        />
      )
    }
    // ==== اصلاح ارور TypeScript اینجا تمام می‌شود ==== 👆
  }

  const mergedComponents: Options["components"] = {
    ...defaultComponents,
    ...components
  }

  return (
    <div
      dir={dir}
      className={cn(
        "w-full",
        // این کلاس‌ها قبلاً برای رفع اسکرول دوتایی حذف شدند
        // "scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-400 max-h-[70vh] overflow-y-auto",
        // "sm:max-h-full sm:overflow-visible",
        className
      )}
      style={style}
    >
      <MessageMarkdownMemoized
        className={cn(
          "chat-markdown-content font-vazir min-w-full break-words"
        )}
        remarkPlugins={[remarkGfm, remarkMath]}
        components={mergedComponents}
      >
        {cleanedContent}
      </MessageMarkdownMemoized>
    </div>
  )
}
