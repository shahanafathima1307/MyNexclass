import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import botMascot from "@/assets/tutor-bot.png";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/assistant")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ask Hoot — myNexClass assistant" },
      {
        name: "description",
        content:
          "Ask myNexClass's built-in assistant how to schedule classes, share recordings, invite people and more.",
      },
      { property: "og:title", content: "Ask Hoot — myNexClass assistant" },
      {
        property: "og:description",
        content: "myNexClass's built-in helper answers questions about using the platform.",
      },
    ],
  }),
  component: AssistantPage,
});

const STORAGE_KEY = "mynexclass.assistant.conversation.v1";

function loadMessages(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as UIMessage[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const SUGGESTIONS = [
  "How do I schedule a demo class?",
  "Where can I find my lesson recordings?",
  "How do I send the join link to my student?",
  "How do time zones work for classes?",
];

function AssistantPage() {
  const [initialMessages] = useState<UIMessage[]>(loadMessages);
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { messages, sendMessage, setMessages, status } = useChat({
    id: "mynexclass-assistant",
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onError: (error) => toast.error(error.message || "The assistant could not reply"),
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* storage full or unavailable — chat still works for this session */
    }
  }, [messages]);

  const busy = status === "submitted" || status === "streaming";

  const focusComposer = useCallback(() => textareaRef.current?.focus(), []);
  useEffect(() => {
    if (!busy) focusComposer();
  }, [busy, focusComposer]);

  const ask = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setInput("");
      void sendMessage({ text: trimmed });
      focusComposer();
    },
    [busy, sendMessage, focusComposer],
  );

  function clearChat() {
    setMessages([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    focusComposer();
  }

  return (
    <AppShell
      title="Ask Hoot"
      subtitle="Your myNexClass helper — answers questions about classes, recordings and the app."
      actions={
        <Button variant="outline" onClick={clearChat} disabled={!messages.length}>
          <RefreshCcw className="size-4" />
          New conversation
        </Button>
      }
    >
      <Card className="flex h-[65vh] min-h-[420px] flex-col overflow-hidden border-border shadow-soft">
        <Conversation>
          <ConversationContent>
            {messages.length === 0 ? (
              <ConversationEmptyState
                icon={
                  <img
                    src={botMascot}
                    alt="Hoot, the myNexClass assistant"
                    width={512}
                    height={512}
                    loading="lazy"
                    className="size-20"
                  />
                }
                title="Hi, I'm Hoot"
                description="Ask me anything about using myNexClass."
              >
                <img
                  src={botMascot}
                  alt="Hoot, the myNexClass assistant"
                  width={512}
                  height={512}
                  loading="lazy"
                  className="size-20"
                />
                <div className="space-y-1">
                  <h3 className="font-display text-base font-semibold">Hi, I&apos;m Hoot</h3>
                  <p className="text-sm text-muted-foreground">
                    Ask me anything about using myNexClass.
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <Button key={s} size="sm" variant="outline" onClick={() => ask(s)}>
                      {s}
                    </Button>
                  ))}
                </div>
              </ConversationEmptyState>
            ) : (
              messages.map((message) => (
                <Message key={message.id} from={message.role}>
                  <MessageContent>
                    {message.parts.map((part, i) =>
                      part.type === "text" ? (
                        <MessageResponse key={i}>{part.text}</MessageResponse>
                      ) : null,
                    )}
                  </MessageContent>
                </Message>
              ))
            )}
            {status === "submitted" && (
              <Message from="assistant">
                <MessageContent>
                  <Shimmer>Hoot is thinking…</Shimmer>
                </MessageContent>
              </Message>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t border-border p-3">
          <PromptInput
            onSubmit={(_message, event) => {
              event.preventDefault();
              ask(input);
            }}
          >
            <PromptInputTextarea
              ref={textareaRef}
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about classes, recordings, invites…"
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={status} disabled={!input.trim() && !busy} />
            </PromptInputFooter>
          </PromptInput>
          <p className="mt-2 text-xs text-muted-foreground">
            Hoot answers general questions about myNexClass. It can&apos;t see or change your class
            data.
          </p>
        </div>
      </Card>
    </AppShell>
  );
}
