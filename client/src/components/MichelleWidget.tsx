import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useUser } from "@/components/UserContext";

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface MichelleResponse {
  reply: string;
  nextQuestions: string[];
  conversationId: string;
  mode: string;
  accessLevel: string;
}

interface MichelleWidgetProps {
  context?: {
    currentPage?: string;
    caseId?: string;
    workerName?: string;
  };
}

export function MichelleWidget({ context }: MichelleWidgetProps) {
  const { user } = useUser();
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
      // Start with a personalized greeting message
      const hour = new Date().getHours();
      const timeGreeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
      // Extract first name only (before first space)
      const firstName = user?.name ? user.name.split(' ')[0] : "there";
      const greeting: ChatMessage = {
        role: 'assistant',
        content: `${timeGreeting}, ${firstName}. I'm Michelle, your personal case manager. How can I help you today?`,
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
      console.log('API REQUEST:', { conversationId, message, context });
      try {
        const response = await apiRequest('POST', '/api/michelle/chat', {
          conversationId,
          message,
          context
        });
        console.log('RAW API RESPONSE:', response);
        const data = await response.json();
        console.log('PARSED API RESPONSE:', data);
        return data as MichelleResponse;
      } catch (error) {
        console.error('API REQUEST FAILED:', error);
        throw error;
      }
    },
    onSuccess: (data: MichelleResponse) => {
      console.log('SUCCESS:', data);
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.reply,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
      setNextQuestions(data.nextQuestions || ['Tell me more about your situation']);
      setConversationId(data.conversationId);
    },
    onError: (error) => {
      console.error('MUTATION ERROR:', error);
      // Show error in UI
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I\'m having trouble connecting. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
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

  // Get responsive dimensions
  const isMobile = window.innerWidth <= 768;
  const getWidgetDimensions = () => {
    if (isMobile) {
      return {
        width: Math.min(window.innerWidth - 32, 525), // Max 525px or screen width - 32px margin (50% wider)
        height: Math.min(window.innerHeight - 100, 500) // Max 500px or screen height - 100px margin
      };
    }
    return {
      width: 480, // Desktop default (50% wider: 320 * 1.5 = 480)
      height: 384
    };
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
    
    // Keep widget on screen with proper margins
    const dimensions = getWidgetDimensions();
    const margin = isMobile ? 16 : 20; // Smaller margin on mobile
    
    const maxX = Math.max(margin, window.innerWidth - dimensions.width - margin);
    const maxY = Math.max(margin, window.innerHeight - dimensions.height - margin);
    
    setPosition({
      x: Math.max(margin, Math.min(newX, maxX)),
      y: Math.max(margin, Math.min(newY, maxY))
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle window resize to adjust positioning
  useEffect(() => {
    const handleResize = () => {
      const dimensions = getWidgetDimensions();
      const margin = window.innerWidth <= 768 ? 16 : 20;
      
      // Adjust position if widget is now outside screen bounds
      setPosition(prev => ({
        x: Math.max(margin, Math.min(prev.x, window.innerWidth - dimensions.width - margin)),
        y: Math.max(margin, Math.min(prev.y, window.innerHeight - dimensions.height - margin))
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  const dimensions = getWidgetDimensions();

  return (
    <div 
      ref={dragRef}
      className="fixed z-50"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        bottom: 'auto',
        right: 'auto',
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`
      }}
    >
      <Card className="w-full h-full flex flex-col shadow-lg overflow-hidden">
        <CardHeader 
          className="flex flex-row items-center justify-between py-3 cursor-move flex-shrink-0"
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
        
        <CardContent className="flex-1 flex flex-col gap-2 p-4 min-h-0 overflow-hidden">
          <ScrollArea className="flex-1 pr-2 overflow-x-hidden">
            <div className="space-y-3 max-w-full overflow-hidden">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  data-testid={`message-${message.role}-${index}`}
                >
                  <div
                    className={`rounded-lg px-3 py-2 text-sm ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-muted text-muted-foreground'
                    }`}
                    style={{ 
                      maxWidth: isMobile 
                        ? (message.role === 'user' ? '280px' : '310px')
                        : (message.role === 'user' ? '85%' : '95%'),
                      overflowWrap: 'break-word',
                      wordBreak: 'break-word',
                      hyphens: 'auto',
                      width: 'fit-content'
                    }}
                  >
                    <div 
                      className="whitespace-pre-wrap leading-relaxed"
                    >
                      {message.content}
                    </div>
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
                  <div className="flex flex-wrap gap-1 overflow-hidden" style={{ width: '100%' }}>
                    {nextQuestions.map((question, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="cursor-pointer text-xs hover-elevate flex-shrink"
                        onClick={() => handleQuestionClick(question)}
                        data-testid={`suggestion-${index}`}
                        style={{
                          maxWidth: isMobile ? '420px' : '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'inline-block'
                        }}
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
          
          <div className="flex gap-2 flex-shrink-0 items-end">
            <Textarea
              placeholder="Ask Michelle about health matters..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={chatMutation.isPending}
              className="flex-1 text-sm resize-none min-h-[80px]"
              rows={3}
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