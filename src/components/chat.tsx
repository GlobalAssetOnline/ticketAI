"use client";

import { useState, useRef, useEffect } from "react";
import { processChat, getSlashCommands } from "@/actions/chat";
import type { ChatMessage } from "@/lib/ai";
import ReactMarkdown from "react-markdown";

interface ChatProps {
  ticketId: number;
  isAuthenticated: boolean;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  slashCommand?: string;
}

interface SlashCommand {
  command: string;
  description: string;
}

export function Chat({ ticketId, isAuthenticated }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commands, setCommands] = useState<SlashCommand[]>([]);
  const [showCommands, setShowCommands] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load slash commands (including client-side only commands)
  useEffect(() => {
    getSlashCommands().then(serverCommands => {
      // Add client-side only commands
      const clientCommands = [
        { command: "/refresh", description: "Clear chat and start fresh" },
      ];
      setCommands([...clientCommands, ...serverCommands]);
    });
  }, []);

  // Auto-scroll to bottom - only when new messages added, not on every render
  const prevMessagesLength = useRef(messages.length);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Only scroll if messages were actually added
    if (messages.length > prevMessagesLength.current) {
      // Use requestAnimationFrame to avoid layout thrashing
      requestAnimationFrame(() => {
        // Scroll the container directly instead of scrollIntoView
        // (scrollIntoView can affect parent iframe scroll)
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      });
    }
    prevMessagesLength.current = messages.length;
  }, [messages.length]);

  // Show commands dropdown when typing /
  useEffect(() => {
    setShowCommands(input.startsWith("/") && input.length > 0);
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading || !isAuthenticated) return;
    
    let userMessage = input.trim();
    setInput("");
    setError(null);
    setShowCommands(false);
    
    // Handle /refresh locally - clear chat without server call
    if (userMessage.toLowerCase() === "/refresh") {
      setMessages([]);
      return;
    }
    
    // Normalise "/5 whys" to "/5whys"
    if (userMessage.toLowerCase().startsWith("/5 whys")) {
      userMessage = "/5whys" + userMessage.slice(7);
    }
    
    // Add user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    
    setIsLoading(true);
    
    try {
      // Convert messages to API format
      const chatHistory: ChatMessage[] = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));
      
      const response = await processChat({
        ticketId,
        messages: chatHistory,
        userMessage,
      });
      
      // Add assistant message
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.message,
        timestamp: new Date(),
        slashCommand: response.slashCommand,
      };
      setMessages(prev => [...prev, assistantMsg]);
      
    } catch (err) {
      console.error("Chat error:", err);
      setError(err instanceof Error ? err.message : "Failed to get response");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommandClick = (cmd: string) => {
    setInput(cmd + " ");
    setShowCommands(false);
    inputRef.current?.focus();
  };

  const filteredCommands = commands.filter(c => 
    c.command.toLowerCase().includes(input.toLowerCase())
  );

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 text-gray-500 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-[#222E40] border-t-[#DEDC00] rounded-full animate-spin" />
          Authenticating with ConnectWise...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Branded header */}
      <div className="bg-[#222E40] px-3 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#DEDC00]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
          </svg>
          <span className="text-white text-sm font-semibold tracking-wide">TicketWise</span>
        </div>
        <span className="bg-[#DEDC00] text-[#222E40] text-xs font-bold px-2 py-0.5 rounded-full">
          #{ticketId}
        </span>
      </div>

      {/* Messages area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8 px-4">
            <div className="w-10 h-10 bg-[#222E40] rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-[#DEDC00]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
              </svg>
            </div>
            <p className="font-semibold text-[#222E40] mb-1">Welcome to TicketWise</p>
            <p className="text-gray-500 text-xs mb-3">Ask me anything about this ticket, or try a command:</p>
            <div className="flex flex-wrap justify-center gap-1.5 mt-2">
              {commands.slice(0, 4).map(cmd => (
                <button
                  key={cmd.command}
                  onClick={() => handleCommandClick(cmd.command)}
                  className="px-2.5 py-1 border border-[#222E40] text-[#222E40] hover:bg-[#222E40] hover:text-white rounded text-xs font-mono font-medium transition-colors"
                >
                  {cmd.command}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                msg.role === "user"
                  ? "bg-[#222E40] text-white shadow-sm"
                  : "bg-white border border-slate-200 text-gray-900 shadow-sm"
              }`}
            >
              {msg.slashCommand && (
                <div className={`text-xs mb-1 font-mono ${msg.role === "user" ? "text-[#DEDC00]/80" : "text-[#824192]"}`}>
                  {msg.slashCommand}
                </div>
              )}
              <div id={`msg-${msg.id}`} className={`text-sm prose prose-sm max-w-none ${msg.role === "user" ? "prose-invert" : ""}`}>
                {msg.role === "assistant" ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                  <span>{msg.content}</span>
                )}
              </div>
              {msg.role === "assistant" && (
                <div className="mt-1.5 flex justify-start">
                  <button
                    onClick={(e) => {
                      const btn = e.currentTarget;
                      const el = document.getElementById(`msg-${msg.id}`);
                      if (!el) return;
                      try {
                        // Select the rendered HTML content and copy via execCommand
                        // (navigator.clipboard is blocked in cross-origin iframes)
                        const range = document.createRange();
                        range.selectNodeContents(el);
                        const sel = window.getSelection();
                        if (sel) {
                          sel.removeAllRanges();
                          sel.addRange(range);
                          document.execCommand("copy");
                          sel.removeAllRanges();
                        }
                        btn.textContent = "✓ Copied";
                      } catch {
                        btn.textContent = "✗ Failed";
                      }
                      setTimeout(() => { btn.textContent = "📋 Copy"; }, 1500);
                    }}
                    className="text-xs px-2 py-0.5 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    📋 Copy
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
              <div className="flex space-x-1 items-center">
                <div className="w-2 h-2 bg-[#F8AB08] rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-[#F8AB08] rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 bg-[#F8AB08] rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2 text-center">
            {error}
          </div>
        )}
      </div>
      
      {/* Input area */}
      <div className="border-t border-slate-200 bg-white p-2 relative">
        {/* Commands dropdown */}
        {showCommands && filteredCommands.length > 0 && (
          <div className="absolute bottom-full left-2 right-2 mb-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
            {filteredCommands.map(cmd => (
              <button
                key={cmd.command}
                onClick={() => handleCommandClick(cmd.command)}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 border-l-2 border-l-transparent hover:border-l-[#222E40] flex items-center gap-2 transition-colors"
              >
                <span className="font-mono text-sm text-[#222E40] font-medium">{cmd.command}</span>
                <span className="text-xs text-gray-400">{cmd.description}</span>
              </button>
            ))}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about this ticket... (try /summary)"
            disabled={isLoading}
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#222E40] focus:border-transparent disabled:bg-gray-50 bg-white"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-[#222E40] text-white rounded-lg text-sm font-medium hover:bg-[#1a2433] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
