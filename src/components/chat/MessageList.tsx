"use client";

import { Message } from "ai";
import { cn } from "@/lib/utils";
import { User, Bot, Loader2, FilePlus, FilePen, FileSearch, Trash2, FolderInput } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import styles from "./MessageList.module.css";

function getToolLabel(toolName: string, args: Record<string, unknown>): { action: string; file: string; Icon: React.ElementType } {
  const path = (args?.path as string) ?? "";
  const newPath = (args?.new_path as string) ?? "";
  const command = (args?.command as string) ?? "";
  const filename = path.split("/").filter(Boolean).pop() ?? path;
  const newFilename = newPath.split("/").filter(Boolean).pop() ?? newPath;

  if (toolName === "str_replace_editor") {
    switch (command) {
      case "create":     return { action: "Creating",  file: filename, Icon: FilePlus };
      case "str_replace":
      case "insert":     return { action: "Editing",   file: filename, Icon: FilePen };
      case "view":       return { action: "Viewing",   file: filename, Icon: FileSearch };
      default:           return { action: "Editing",   file: filename, Icon: FilePen };
    }
  }
  if (toolName === "file_manager") {
    if (command === "rename") return { action: "Renaming", file: `${filename} → ${newFilename}`, Icon: FolderInput };
    if (command === "delete")  return { action: "Deleting", file: filename, Icon: Trash2 };
  }
  return { action: toolName, file: filename, Icon: FilePen };
}

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>
          <Bot className="h-7 w-7" style={{ color: "var(--brand-600)" }} aria-hidden="true" />
        </div>
        <p className={styles.emptyTitle}>Start a conversation to generate React components</p>
        <p className={styles.emptySubtext}>I can help you create buttons, forms, cards, and more</p>
      </div>
    );
  }

  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
      className={styles.messageList}
    >
      <div className={styles.messageStack}>
        {messages.map((message) => (
          <div
            key={message.id || message.content}
            className={message.role === "user" ? styles.messageRowUser : styles.messageRowAssistant}
          >
            {message.role === "assistant" && (
              <div className={styles.avatarAssistant}>
                <Bot className="h-4 w-4" style={{ color: "var(--text-secondary)" }} aria-hidden="true" />
              </div>
            )}

            <div className={message.role === "user" ? styles.messageContentUser : styles.messageContentAssistant}>
              <div className={message.role === "user" ? styles.bubbleUser : styles.bubbleAssistant}>
                {message.parts ? (
                  <>
                    {message.parts.map((part, partIndex) => {
                      switch (part.type) {
                        case "text":
                          return message.role === "user" ? (
                            <span key={partIndex} className="whitespace-pre-wrap">{part.text}</span>
                          ) : (
                            <MarkdownRenderer
                              key={partIndex}
                              content={part.text}
                              className="prose-sm"
                            />
                          );
                        case "reasoning":
                          return (
                            <div key={partIndex} className={styles.reasoningBlock}>
                              <span className={styles.reasoningLabel}>Reasoning</span>
                              <span className={styles.reasoningText}>{part.reasoning}</span>
                            </div>
                          );
                        case "tool-invocation": {
                          const tool = part.toolInvocation;
                          const { action, file, Icon } = getToolLabel(tool.toolName, tool.args as Record<string, unknown>);
                          const done = tool.state === "result" && tool.result;
                          return (
                            <div key={partIndex} className={styles.toolBadge}>
                              {done ? (
                                <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "oklch(0.527 0.154 150)" }} aria-hidden="true" />
                              ) : (
                                <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" style={{ color: "var(--brand-600)" }} aria-hidden="true" />
                              )}
                              <span className={styles.toolBadgeLabel}>{action}</span>
                              <span className={styles.toolBadgeFile}>{file}</span>
                            </div>
                          );
                        }
                        case "source":
                          return (
                            <div key={partIndex} className={styles.sourceCitation}>
                              Source: {JSON.stringify(part.source)}
                            </div>
                          );
                        case "step-start":
                          return partIndex > 0 ? <hr key={partIndex} className={styles.stepDivider} /> : null;
                        default:
                          return null;
                      }
                    })}
                    {isLoading &&
                      message.role === "assistant" &&
                      messages.indexOf(message) === messages.length - 1 && (
                        <div className={styles.loadingIndicator}>
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                          <span>Generating...</span>
                        </div>
                      )}
                  </>
                ) : message.content ? (
                  message.role === "user" ? (
                    <span className="whitespace-pre-wrap">{message.content}</span>
                  ) : (
                    <MarkdownRenderer content={message.content} className="prose-sm" />
                  )
                ) : isLoading &&
                  message.role === "assistant" &&
                  messages.indexOf(message) === messages.length - 1 ? (
                  <div className={styles.loadingIndicator}>
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    <span>Generating...</span>
                  </div>
                ) : null}
              </div>
            </div>

            {message.role === "user" && (
              <div className={styles.avatarUser}>
                <User className="h-4 w-4 text-white" aria-hidden="true" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
