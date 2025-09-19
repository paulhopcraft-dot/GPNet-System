import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Send, Bot, User, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  id: string;
  type: "user" | "michelle";
  content: string;
  timestamp: Date;
  flags?: {
    risk: string[];
    compliance: string[];
    escalation: string[];
  };
  next_questions?: string[];
  extracted_fields?: Record<string, any>;
  legislation_refs?: string[];
}

interface MichelleChatProps {
  ticketId: string;
  conversationId?: string;
}

export function MichelleChat({ ticketId, conversationId = `chat-${ticketId}-${Date.now()}` }: MichelleChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      type: "michelle",
      content: "Hi! I'm Michelle, your workplace health assistant. I'm here to help with any questions about your injury, return to work, or workplace health concerns. How can I help you today?",
      timestamp: new Date(),
      next_questions: [
        "I have pain or discomfort I'd like to discuss",
        "I need help with my return to work plan",
        "I have questions about my workplace rights"
      ],
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<Record<string, any>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: "user",
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          message: content,
          userId: ticketId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const result = await response.json();

      // Handle escalation flags
      if (result.flags?.escalation?.length > 0) {
        if (result.flags.escalation.includes("self_harm") || result.flags.escalation.includes("acute_distress")) {
          toast({
            title: "Immediate Support Available",
            description: "If you're experiencing thoughts of self-harm, please contact your healthcare provider immediately or call a crisis helpline.",
            variant: "destructive",
          });
        }
      }

      // Update extracted data
      if (result.extracted_fields) {
        setExtractedData(prev => ({ ...prev, ...result.extracted_fields }));
      }

      const michelleMessage: ChatMessage = {
        id: `michelle-${Date.now()}`,
        type: "michelle",
        content: result.reply_text,
        timestamp: new Date(),
        flags: result.flags,
        next_questions: result.next_questions || [],
        extracted_fields: result.extracted_fields,
        legislation_refs: result.legislation_refs || [],
      };

      setMessages(prev => [...prev, michelleMessage]);

    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        type: "michelle",
        content: "I'm sorry, I'm experiencing technical difficulties right now. Please try again in a moment, or contact your case manager if this continues.",
        timestamp: new Date(),
        flags: { risk: [], compliance: [], escalation: ["technical_issue"] },
      };
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Connection Error", 
        description: "Unable to connect to Michelle. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuestionClick = (question: string) => {
    sendMessage(question);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  return (
    <div className="space-y-4">
      {/* Chat Window */}
      <Card className="h-96">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Michelle - AI Health Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72 overflow-y-auto space-y-3">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-lg p-3 ${
                message.type === "user" 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground"
              }`}>
                <div className="flex items-start gap-2">
                  {message.type === "michelle" ? (
                    <Bot className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  ) : (
                    <User className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <div className="text-sm">{message.content}</div>
                    <div className="flex items-center gap-1 mt-1 text-xs opacity-70">
                      <Clock className="h-3 w-3" />
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>

                {/* Flags and Alerts */}
                {message.flags && (
                  <div className="mt-2 space-y-1">
                    {message.flags.risk.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {message.flags.risk.map((risk, i) => (
                          <Badge key={i} variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {risk}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {message.flags.escalation.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {message.flags.escalation.map((escalation, i) => (
                          <Badge key={i} variant="destructive" className="text-xs">
                            URGENT: {escalation}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Suggested Questions */}
                {message.next_questions && message.next_questions.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="text-xs font-medium">Suggested questions:</div>
                    {message.next_questions.map((question, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        className="text-xs h-auto py-1 px-2 mr-1 mb-1"
                        onClick={() => handleQuestionClick(question)}
                        disabled={isLoading}
                        data-testid={`button-suggestion-${i}`}
                      >
                        {question}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Legislation References */}
                {message.legislation_refs && message.legislation_refs.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-medium mb-1">Related legislation:</div>
                    <div className="flex flex-wrap gap-1">
                      {message.legislation_refs.map((ref, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {ref}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted text-muted-foreground rounded-lg p-3 max-w-[80%]">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  <div className="flex space-x-1">
                    <div className="h-2 w-2 bg-current rounded-full animate-bounce"></div>
                    <div className="h-2 w-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                    <div className="h-2 w-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </CardContent>
      </Card>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type your message..."
          disabled={isLoading}
          className="flex-1"
          data-testid="input-chat-message"
        />
        <Button 
          type="submit" 
          disabled={isLoading || !inputValue.trim()}
          data-testid="button-send-message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>

      {/* Extracted Data Summary */}
      {Object.keys(extractedData).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Information Gathered</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(extractedData).map(([key, value]) => (
              <div key={key} className="flex justify-between text-sm">
                <span className="font-medium capitalize">{key.replace('_', ' ')}:</span>
                <span className="text-muted-foreground">{String(value)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}