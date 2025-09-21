import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Send, Bot, User, Archive, Sparkles, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  nextStepSuggestion?: string;
  confidence?: number;
}

interface MichelleContext {
  userId: string;
  userRole: string;
  organizationId: string;
  isImpersonating: boolean;
  isSuperuser: boolean;
  mode: "universal" | "client-scoped";
  capabilities: string[];
  availableConversationTypes: string[];
}

interface ConversationResponse {
  conversationId: string;
  response: string;
  nextStepSuggestion?: string;
  confidence: number;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
  };
}

interface MichelleChatProps {
  ticketId?: string;
  workerId?: string;
  mode?: "universal" | "case-specific" | "client-scoped";
  className?: string;
}

export function MichelleChat({ 
  ticketId, 
  workerId, 
  mode = "client-scoped",
  className = ""
}: MichelleChatProps) {
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Get Michelle context for the current user
  const { data: michelleContext } = useQuery<MichelleContext>({
    queryKey: ["/api/michelle/context"]
  });

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Add welcome message when component mounts
    if (messages.length === 0) {
      const welcomeMessage: Message = {
        id: "welcome",
        role: "assistant",
        content: getWelcomeMessage(),
        timestamp: new Date().toISOString()
      };
      setMessages([welcomeMessage]);
    }
  }, [mode]);

  const getWelcomeMessage = () => {
    switch (mode) {
      case "universal":
        return "Hi! I'm Michelle, your universal admin assistant. I can help with platform-wide analytics, cross-tenant insights, and system administration. What would you like to know?";
      case "case-specific":
        return `Hi! I'm Michelle, your case assistant. I'm here to help with ${ticketId ? `case ${ticketId.slice(-8)}` : "this specific case"}. How can I assist you today?`;
      default:
        return "Hi! I'm Michelle, your workplace health assistant. I'm here to help with cases, worker assessments, and organizational health management. How can I help you today?";
    }
  };

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string): Promise<ConversationResponse> => {
      const context = {
        mode: mode === "universal" ? "universal" : mode,
        ticketId,
        workerId
      };

      const response = await apiRequest("POST", "/api/michelle/chat", {
        conversationId: currentConversationId,
        message,
        context
      });
      return response.json();
    },
    onSuccess: (response) => {
      // Add user message
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: inputMessage,
        timestamp: new Date().toISOString()
      };

      // Add assistant response
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant", 
        content: response.response,
        timestamp: new Date().toISOString(),
        nextStepSuggestion: response.nextStepSuggestion,
        confidence: response.confidence
      };

      setMessages(prev => [...prev, userMessage, assistantMessage]);
      setCurrentConversationId(response.conversationId);
      setInputMessage("");
      setIsTyping(false);
    },
    onError: (error) => {
      console.error("Failed to send message:", error);
      
      // Add error message to chat
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "I'm sorry, I'm experiencing technical difficulties right now. Please try again in a moment, or contact your case manager if this continues.",
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Error",
        description: "Failed to send message to Michelle. Please try again.",
        variant: "destructive"
      });
      setIsTyping(false);
    }
  });

  // Archive conversation mutation
  const archiveConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await fetch(`/api/michelle/conversation/${conversationId}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        throw new Error("Failed to archive conversation");
      }
      return response.json();
    },
    onSuccess: () => {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: getWelcomeMessage(),
        timestamp: new Date().toISOString()
      }]);
      setCurrentConversationId(null);
      toast({
        title: "Conversation Archived",
        description: "Your conversation with Michelle has been archived."
      });
    },
    onError: (error) => {
      console.error("Failed to archive conversation:", error);
      toast({
        title: "Error", 
        description: "Failed to archive conversation.",
        variant: "destructive"
      });
    }
  });

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || sendMessageMutation.isPending) return;

    setIsTyping(true);
    sendMessageMutation.mutate(inputMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleArchiveConversation = () => {
    if (currentConversationId) {
      archiveConversationMutation.mutate(currentConversationId);
    }
  };

  const getModeDisplay = () => {
    switch (mode) {
      case "universal":
        return { 
          label: "Universal Admin", 
          color: "destructive" as const,
          description: "Cross-tenant access with PHI redaction"
        };
      case "case-specific":
        return { 
          label: "Case Assistant", 
          color: "default" as const,
          description: `Focused on ${ticketId ? `case ${ticketId.slice(-8)}` : "current case"}`
        };
      default:
        return { 
          label: "Client Assistant", 
          color: "secondary" as const,
          description: "Organization-scoped support"
        };
    }
  };

  const modeDisplay = getModeDisplay();

  return (
    <Card className={`h-full flex flex-col ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Michelle AI</CardTitle>
            </div>
            <Badge variant={modeDisplay.color} data-testid="badge-michelle-mode">
              {modeDisplay.label}
            </Badge>
          </div>
          {currentConversationId && (
            <Button
              variant="ghost" 
              size="sm"
              onClick={handleArchiveConversation}
              disabled={archiveConversationMutation.isPending}
              data-testid="button-archive-conversation"
            >
              <Archive className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{modeDisplay.description}</p>
        {michelleContext?.isImpersonating && (
          <Badge variant="outline" className="w-fit">
            Impersonating Client
          </Badge>
        )}
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                )}
                
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                  data-testid={`message-${message.role}`}
                >
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                  
                  <div className="flex items-center gap-1 mt-2 text-xs opacity-70">
                    <Clock className="h-3 w-3" />
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                  
                  {message.nextStepSuggestion && (
                    <div className="mt-3 pt-2 border-t border-border/20">
                      <p className="text-xs opacity-80 font-medium">Suggested next step:</p>
                      <p className="text-xs opacity-90 mt-1">{message.nextStepSuggestion}</p>
                    </div>
                  )}
                  
                  {message.confidence && message.role === "assistant" && (
                    <div className="mt-1 text-xs opacity-60">
                      Confidence: {message.confidence}%
                    </div>
                  )}
                </div>

                {message.role === "user" && (
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                    <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
          <div ref={messagesEndRef} />
        </ScrollArea>

        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                mode === "universal" 
                  ? "Ask about platform trends..."
                  : mode === "case-specific"
                  ? "Ask about this case..."
                  : "Ask Michelle for help..."
              }
              disabled={sendMessageMutation.isPending}
              data-testid="input-michelle-message"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || sendMessageMutation.isPending}
              data-testid="button-send-message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}