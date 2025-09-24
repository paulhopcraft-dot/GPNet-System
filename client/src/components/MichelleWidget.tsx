import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface MichelleResponse {
  response: string;
  nextStepSuggestion: string;
  conversationId: string;
  confidence: number;
}

interface MichelleWidgetProps {
  context?: {
    currentPage?: string;
    caseId?: string;
    workerName?: string;
  };
}

export function MichelleWidget({ context }: MichelleWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [conversationId, setConversationId] = useState<string>("");
  const [nextQuestions, setNextQuestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Drag functionality state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const dragRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Start with a greeting message
      const greeting: ChatMessage = {
        role: 'assistant',
        content: `Hi! I'm Michelle, your occupational health assistant. How can I help you today?`,
        timestamp: new Date()
      };
      setMessages([greeting]);
      setNextQuestions([
        'Tell me about any health concerns',
        'What type of work role is this about?',
        'Do you have questions about a specific case?'
      ]);
      setConversationId(`conv_${Date.now()}`);
    }
  }, [isOpen]);

  const chatMutation = useMutation({
    mutationFn: async (message: string): Promise<MichelleResponse> => {
      console.log('Michelle API Call:', { conversationId, message, context });
      const response = await apiRequest('POST', '/api/michelle/chat', {
        conversationId,
        message,
        context
      });
      console.log('Michelle API Response:', response);
      return response as MichelleResponse;
    },
    onSuccess: (data: MichelleResponse) => {
      console.log('Michelle onSuccess:', data);
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
      setNextQuestions([data.nextStepSuggestion || 'Tell me more about your situation']);
      setConversationId(data.conversationId);
    },
    onError: (error) => {
      console.error('Michelle API Error:', error);
    }
  });

  const handleSendMessage = (message: string) => {
    if (!message.trim() || chatMutation.isPending) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: message.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    chatMutation.mutate(message.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputMessage);
    }
  };

  const handleQuestionClick = (question: string) => {
    handleSendMessage(question);
  };

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const rect = dragRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    // Keep widget on screen
    const maxX = window.innerWidth - 320; // widget width
    const maxY = window.innerHeight - 384; // widget height
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add global mouse listeners for drag
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          size="icon"
          className="h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover-elevate"
          data-testid="button-michelle-open"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  return (
    <div 
      ref={dragRef}
      className="fixed z-50"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        bottom: 'auto',
        right: 'auto'
      }}
    >
      <Card className="w-80 h-96 flex flex-col">
        <CardHeader 
          className="flex flex-row items-center justify-between py-3 cursor-move"
          onMouseDown={handleMouseDown}
        >
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Michelle AI
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8"
            data-testid="button-michelle-close"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col gap-2 p-4">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-3">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  data-testid={`message-${message.role}-${index}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              
              {chatMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Michelle is thinking...
                  </div>
                </div>
              )}
              
              {nextQuestions.length > 0 && !chatMutation.isPending && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Suggested questions:</div>
                  <div className="flex flex-wrap gap-1">
                    {nextQuestions.map((question, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="cursor-pointer text-xs hover-elevate"
                        onClick={() => handleQuestionClick(question)}
                        data-testid={`suggestion-${index}`}
                      >
                        {question}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div ref={messagesEndRef} />
          </ScrollArea>
          
          <div className="flex gap-2">
            <Input
              placeholder="Ask Michelle about health matters..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={chatMutation.isPending}
              className="flex-1"
              data-testid="input-michelle-message"
            />
            <Button
              onClick={() => handleSendMessage(inputMessage)}
              disabled={!inputMessage.trim() || chatMutation.isPending}
              size="icon"
              data-testid="button-michelle-send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}