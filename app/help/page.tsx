"use client"

import { useState, useRef, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import { Button } from "@/components/ui/button"
import { Send, CircleHelp } from "lucide-react"
import { cn } from "@/lib/utils"

type ChatMessage = {
  role: "user" | "assistant"
  content: string
  navigate?: { page: string; label: string } | null
  highlight?: string | null
}

// Renders **bold** as <strong> regardless of whether the model remembers to
// avoid markdown — code-level fix rather than relying on prompt compliance.
function FormattedText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\*\*([^*]+)\*\*$/)
        return match ? <strong key={i}>{match[1]}</strong> : <span key={i}>{part}</span>
      })}
    </>
  )
}

export default function HelpPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login")
  }, [status, router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }]
    setMessages(nextMessages)
    setInput("")
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Something went wrong.")
        return
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.text, navigate: data.navigate, highlight: data.highlight }])
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main
        className="max-w-lg mx-auto px-4 sm:px-6 pt-20"
        style={{ paddingBottom: "calc(150px + env(safe-area-inset-bottom))" }}
      >
        {messages.length === 0 && (
          <div className="mt-6 mb-6 text-center">
            <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-3">
              <CircleHelp className="w-6 h-6 text-secondary" />
            </div>
            <h1 className="text-xl font-bold text-primary mb-1">How can I help?</h1>
            <p className="text-sm text-on-surface-variant">
              Ask me anything about booking, notifications, or how this app works.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 mt-6">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-primary text-on-primary rounded-br-sm"
                    : "bg-white border border-outline-variant/20 text-on-surface-variant rounded-bl-sm"
                )}
              >
                <p className="whitespace-pre-wrap"><FormattedText text={m.content} /></p>
                {m.navigate && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-3 w-full"
                    onClick={() => {
                      if (m.highlight) sessionStorage.setItem("pending-highlight", m.highlight)
                      router.push(m.navigate!.page)
                    }}
                  >
                    Go to {m.navigate.label}
                  </Button>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-outline-variant/20 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-outline animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-outline animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-outline animate-bounce" />
                </div>
              </div>
            </div>
          )}
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <div ref={bottomRef} />
        </div>
      </main>

      <div
        className="fixed left-0 w-full z-40 bg-white/95 backdrop-blur-xl border-t border-outline-variant/20 px-4 sm:px-6 py-3"
        style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}
      >
        <form
          onSubmit={(e) => { e.preventDefault(); send() }}
          className="max-w-lg mx-auto flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            disabled={loading}
            className="flex-1 rounded-full border border-outline-variant/30 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40 disabled:opacity-60"
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()} aria-label="Send">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
