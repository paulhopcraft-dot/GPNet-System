import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Loader2, Send, Bot, User, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ConversationMessage {
  role: 'user' | 'michelle';
  message: string;
  timestamp: Date;
}

interface DialogueData {
  workerFirstName?: string;
  workerLastName?: string;
  workerEmail?: string;
  roleApplied?: string;
  urgencyLevel?: 'low' | 'normal' | 'high' | 'urgent';
  requestReason?: string;
  suggestedCheckKey?: string;
  companyName?: string;
  additionalNotes?: string;
}

interface SuggestedAction {
  type: 'collect_worker_info' | 'select_check' | 'confirm_request' | 'start_over';
  label: string;
  data?: any;
}

interface DialogueSession {
  conversationId: string;
  stage: 'greeting' | 'needs_assessment' | 'worker_collection' | 'check_selection' | 'confirmation' | 'completed';
  response?: string;
  collectedData: DialogueData;
  suggestedActions?: SuggestedAction[];
  isComplete: boolean;
  checkRequestReady: boolean;
  conversationHistory: ConversationMessage[];
}

export default function MichelleDialogue() {
  const { toast } = useToast();
  const [currentSession, setCurrentSession] = useState<DialogueSession | null>(null);
  const [userMessage, setUserMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.conversationHistory]);

  // Start dialogue session
  const startSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/michelle/start', 'POST');
      return await response.json();
    },
    onSuccess: (response) => {
      const data = response.data;
      setCurrentSession({
        conversationId: data.conversationId,
        stage: 'greeting',
        response: data.message,
        collectedData: {},
        isComplete: false,
        checkRequestReady: false,
        conversationHistory: [
          {
            role: 'michelle',
            message: data.message,
            timestamp: new Date()
          }
        ]
      });
      
      toast({
        title: 'Michelle is ready!',
        description: 'You can now start your conversation about health checks.'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Connection Error',
        description: error.message || 'Failed to connect to Michelle',
        variant: 'destructive'
      });
    }
  });

  // Send message to Michelle
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!currentSession) throw new Error('No active session');
      
      const response = await apiRequest('/api/michelle/message', 'POST', {
        conversationId: currentSession.conversationId,
        message
      });
      return await response.json();
    },
    onSuccess: (response) => {
      const data = response.data;
      setCurrentSession(prev => {
        if (!prev) return null;
        
        const newHistory = [
          ...prev.conversationHistory,
          {
            role: 'user' as const,
            message: userMessage,
            timestamp: new Date()
          },
          {
            role: 'michelle' as const,
            message: data.response,
            timestamp: new Date()
          }
        ];

        return {
          ...prev,
          stage: data.stage,
          response: data.response,
          collectedData: data.collectedData,
          suggestedActions: data.suggestedActions,
          isComplete: data.isComplete,
          checkRequestReady: data.checkRequestReady,
          conversationHistory: newHistory
        };
      });
      
      setUserMessage('');
    },
    onError: (error: any) => {
      toast({
        title: 'Message Failed',
        description: error.message || 'Failed to send message to Michelle',
        variant: 'destructive'
      });
    }
  });

  // Submit check request
  const submitRequestMutation = useMutation({
    mutationFn: async () => {
      if (!currentSession) throw new Error('No active session');
      
      const response = await apiRequest('/api/michelle/submit-request', 'POST', {
        conversationId: currentSession.conversationId
      });
      return await response.json();
    },
    onSuccess: (response) => {
      const data = response.data;
      toast({
        title: 'Check Request Created!',
        description: `Health check request created for ${data.worker.name}. An email draft is ready for your review.`
      });
      
      setCurrentSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          stage: 'completed',
          isComplete: true,
          checkRequestReady: false
        };
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Submission Failed',
        description: error.message || 'Failed to create check request',
        variant: 'destructive'
      });
    }
  });

  const handleSendMessage = (message: string = userMessage) => {
    if (!message.trim()) return;
    
    sendMessageMutation.mutate(message);
  };

  const handleSuggestedAction = (action: SuggestedAction) => {
    switch (action.type) {
      case 'collect_worker_info':
        handleSendMessage(`I need help with a ${action.data?.checkType || 'health'} check.`);
        break;
      case 'confirm_request':
        if (currentSession?.checkRequestReady) {
          submitRequestMutation.mutate();
        } else {
          handleSendMessage('Yes, please proceed with this request.');
        }
        break;
      case 'start_over':
        startSessionMutation.mutate();
        break;
      default:
        handleSendMessage(action.label);
    }
  };

  const getStageIcon = (stage: DialogueSession['stage']) => {
    switch (stage) {
      case 'greeting':
        return <Bot className="w-4 h-4 text-blue-500" />;
      case 'needs_assessment':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'worker_collection':
        return <User className="w-4 h-4 text-purple-500" />;
      case 'check_selection':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'confirmation':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      default:
        return <Bot className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStageLabel = (stage: DialogueSession['stage']) => {
    switch (stage) {
      case 'greeting': return 'Getting Started';
      case 'needs_assessment': return 'Understanding Needs';
      case 'worker_collection': return 'Collecting Details';
      case 'check_selection': return 'Selecting Check';
      case 'confirmation': return 'Ready to Submit';
      case 'completed': return 'Complete';
      default: return 'In Progress';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Chat with Michelle
          </h1>
          <p className="text-muted-foreground mt-2">
            Your AI assistant for initiating health checks - just describe what you need in plain language
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Chat Interface */}
          <div className="lg:col-span-3">
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-blue-500" />
                    Michelle - AI Health Check Assistant
                  </CardTitle>
                  {currentSession && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      {getStageIcon(currentSession.stage)}
                      {getStageLabel(currentSession.stage)}
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex flex-col flex-1 p-0">
                {/* Messages Area */}
                <ScrollArea className="flex-1 px-6">
                  <div className="space-y-4 pb-4">
                    {!currentSession ? (
                      <div className="text-center py-12">
                        <Bot className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Ready to start?</h3>
                        <p className="text-muted-foreground mb-6">
                          Begin a conversation with Michelle to set up health checks for your workers.
                        </p>
                        <Button 
                          onClick={() => startSessionMutation.mutate()}
                          disabled={startSessionMutation.isPending}
                          size="lg"
                          data-testid="button-start-conversation"
                        >
                          {startSessionMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            <>
                              <Bot className="w-4 h-4 mr-2" />
                              Start Conversation
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <>
                        {currentSession.conversationHistory.map((msg, index) => (
                          <div
                            key={index}
                            className={`flex gap-3 ${
                              msg.role === 'user' ? 'justify-end' : 'justify-start'
                            }`}
                            data-testid={`message-${msg.role}-${index}`}
                          >
                            {msg.role === 'michelle' && (
                              <Avatar className="w-8 h-8 mt-1">
                                <AvatarImage src="/michelle-avatar.png" />
                                <AvatarFallback className="bg-blue-100 text-blue-600">
                                  M
                                </AvatarFallback>
                              </Avatar>
                            )}
                            
                            <div
                              className={`max-w-[80%] rounded-lg p-3 ${
                                msg.role === 'user'
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                              }`}
                            >
                              <p className="text-sm leading-relaxed">{msg.message}</p>
                              <span
                                className={`text-xs mt-1 block ${
                                  msg.role === 'user'
                                    ? 'text-blue-100'
                                    : 'text-gray-500 dark:text-gray-400'
                                }`}
                              >
                                {new Date(msg.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            
                            {msg.role === 'user' && (
                              <Avatar className="w-8 h-8 mt-1">
                                <AvatarFallback className="bg-gray-100 text-gray-600">
                                  <User className="w-4 h-4" />
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                        ))}

                        {/* Suggested Actions */}
                        {currentSession.suggestedActions && currentSession.suggestedActions.length > 0 && (
                          <div className="flex flex-wrap gap-2 justify-center mt-4">
                            {currentSession.suggestedActions.map((action, index) => (
                              <Button
                                key={index}
                                variant="outline"
                                size="sm"
                                onClick={() => handleSuggestedAction(action)}
                                disabled={sendMessageMutation.isPending || submitRequestMutation.isPending}
                                data-testid={`suggested-action-${action.type}`}
                              >
                                {action.label}
                              </Button>
                            ))}
                          </div>
                        )}

                        {/* Typing indicator */}
                        {sendMessageMutation.isPending && (
                          <div className="flex gap-3 justify-start">
                            <Avatar className="w-8 h-8 mt-1">
                              <AvatarFallback className="bg-blue-100 text-blue-600">
                                M
                              </AvatarFallback>
                            </Avatar>
                            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                              <div className="flex gap-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div ref={messagesEndRef} />
                      </>
                    )}
                  </div>
                </ScrollArea>

                {/* Input Area */}
                {currentSession && !currentSession.isComplete && (
                  <>
                    <Separator />
                    <div className="p-4">
                      <div className="flex gap-2">
                        <Input
                          value={userMessage}
                          onChange={(e) => setUserMessage(e.target.value)}
                          placeholder="Type your message to Michelle..."
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          disabled={sendMessageMutation.isPending || submitRequestMutation.isPending}
                          data-testid="input-user-message"
                        />
                        <Button
                          onClick={() => handleSendMessage()}
                          disabled={!userMessage.trim() || sendMessageMutation.isPending || submitRequestMutation.isPending}
                          data-testid="button-send-message"
                        >
                          {sendMessageMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      
                      {currentSession.checkRequestReady && (
                        <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                                Ready to submit request
                              </span>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => submitRequestMutation.mutate()}
                              disabled={submitRequestMutation.isPending}
                              data-testid="button-submit-final-request"
                            >
                              {submitRequestMutation.isPending ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Creating...
                                </>
                              ) : (
                                'Submit Request'
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Progress & Data */}
          <div className="lg:col-span-1 space-y-6">
            {currentSession && (
              <>
                {/* Progress Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Progress</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      {getStageIcon(currentSession.stage)}
                      <span>{getStageLabel(currentSession.stage)}</span>
                    </div>
                    
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.round((
                            ['greeting', 'needs_assessment', 'worker_collection', 'check_selection', 'confirmation', 'completed'].indexOf(currentSession.stage) + 1
                          ) / 6 * 100)}%`
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Collected Data */}
                {Object.keys(currentSession.collectedData).length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Collected Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {currentSession.collectedData.workerFirstName && (
                        <div className="text-sm">
                          <span className="font-medium">Name:</span>{' '}
                          {currentSession.collectedData.workerFirstName}{' '}
                          {currentSession.collectedData.workerLastName}
                        </div>
                      )}
                      {currentSession.collectedData.workerEmail && (
                        <div className="text-sm">
                          <span className="font-medium">Email:</span>{' '}
                          {currentSession.collectedData.workerEmail}
                        </div>
                      )}
                      {currentSession.collectedData.suggestedCheckKey && (
                        <div className="text-sm">
                          <span className="font-medium">Check Type:</span>{' '}
                          <Badge variant="secondary" className="text-xs">
                            {currentSession.collectedData.suggestedCheckKey}
                          </Badge>
                        </div>
                      )}
                      {currentSession.collectedData.urgencyLevel && (
                        <div className="text-sm">
                          <span className="font-medium">Urgency:</span>{' '}
                          <Badge
                            variant={
                              currentSession.collectedData.urgencyLevel === 'urgent'
                                ? 'destructive'
                                : currentSession.collectedData.urgencyLevel === 'high'
                                ? 'secondary'
                                : 'outline'
                            }
                            className="text-xs"
                          >
                            {currentSession.collectedData.urgencyLevel}
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Actions */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => startSessionMutation.mutate()}
                      disabled={startSessionMutation.isPending}
                      data-testid="button-restart-conversation"
                    >
                      <Bot className="w-4 h-4 mr-2" />
                      Start New Conversation
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}