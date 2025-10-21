import OpenAI from "openai"

// استفاده از نوع دقیق کتابخانه OpenAI به جای any[]
export const COMPUTER_USE_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] =
  [
    {
      type: "function",
      function: {
        name: "click",
        description: "Clicks on a specific coordinate (x, y) on the screen.",
        parameters: {
          type: "object",
          properties: {
            x: { type: "number", description: "The x-coordinate" },
            y: { type: "number", description: "The y-coordinate" }
          },
          required: ["x", "y"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "type_text",
        description: "Types text into the currently focused element.",
        parameters: {
          type: "object",
          properties: {
            text: { type: "string", description: "The text to type" }
          },
          required: ["text"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "scroll",
        description: "Scrolls the page up or down.",
        parameters: {
          type: "object",
          properties: {
            direction: {
              type: "string",
              enum: ["up", "down"],
              description: "The direction to scroll"
            }
          },
          required: ["direction"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "finish_task",
        description: "Call this when the user's request is fully completed.",
        parameters: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "A final summary message for the user."
            }
          },
          required: ["message"]
        }
      }
    }
  ]
