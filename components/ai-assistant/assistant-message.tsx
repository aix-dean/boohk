import type { ChatMessage } from "@/lib/gemini-service"
import { cn } from "@/lib/utils"

interface AssistantMessageProps {
  message: ChatMessage
}

export function AssistantMessage({ message }: AssistantMessageProps) {
  const isUser = message.role === "user"
  const isLoading = message.isLoading === true

  return (
    <div className={cn("flex w-full items-start gap-2 py-2", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "flex max-w-[80%] flex-col gap-1 rounded-lg px-4 py-2",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {isLoading ? (
          <div className="flex items-center gap-1 py-1">
            <div className="h-2 w-2 animate-bounce rounded-full bg-current"></div>
            <div className="h-2 w-2 animate-bounce rounded-full bg-current" style={{ animationDelay: "0.2s" }}></div>
            <div className="h-2 w-2 animate-bounce rounded-full bg-current" style={{ animationDelay: "0.4s" }}></div>
          </div>
        ) : (
          <div className="whitespace-pre-wrap">
            {message.parts.split("\n").map((part, i) => (
              <p key={i} className={i > 0 ? "mt-2" : ""}>
                {part}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
