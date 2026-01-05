import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History as HistoryIcon, Check, X, RotateCcw, Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import { api, HistoryItem, ShoppingSession } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useGrocery } from '@/contexts/GroceryContext';
import { cn } from '@/lib/utils';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function History() {
  const [sessions, setSessions] = useState<ShoppingSession[]>([]);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [sessionItems, setSessionItems] = useState<Record<string, HistoryItem[]>>({});
  const [filter, setFilter] = useState<'all' | 'found' | 'not_found'>('all');
  const { toast } = useToast();
  const { fetchItems } = useGrocery();

  useEffect(() => {
    loadHistory();
  }, [filter]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const [sessionsData, itemsData] = await Promise.all([
        api.getSessions(20),
        api.getHistory(100, filter === 'all' ? undefined : filter),
      ]);
      setSessions(sessionsData);
      setHistoryItems(itemsData);
    } catch (error) {
      toast({
        title: 'Failed to load history',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadSessionItems = async (sessionId: string) => {
    if (sessionItems[sessionId]) return;
    
    try {
      const items = await api.getSessionItems(sessionId);
      setSessionItems(prev => ({ ...prev, [sessionId]: items }));
    } catch (error) {
      toast({
        title: 'Failed to load session',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  };

  const handleExpandSession = async (sessionId: string) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null);
    } else {
      setExpandedSession(sessionId);
      await loadSessionItems(sessionId);
    }
  };

  const handleRestore = async (itemId: number) => {
    try {
      await api.restoreItem(itemId);
      await fetchItems();
      await loadHistory();
      toast({
        title: 'Item restored',
        description: 'Item has been added back to your list',
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: 'Failed to restore',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (sessions.length === 0 && historyItems.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
          <HistoryIcon className="w-10 h-10 text-purple-600" />
        </div>
        <h3 className="text-xl font-heading font-semibold mb-2">No history yet</h3>
        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
          Complete a shopping session to see your history here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">History</h2>
          <p className="text-muted-foreground">
            {sessions.length} shopping session{sessions.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        {/* Filter buttons */}
        <div className="flex gap-1 bg-muted p-1 rounded-lg">
          {(['all', 'found', 'not_found'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter(f)}
              className={cn(
                'text-xs',
                filter === f && f === 'found' && 'bg-emerald-600 hover:bg-emerald-700',
                filter === f && f === 'not_found' && 'bg-red-500 hover:bg-red-600'
              )}
            >
              {f === 'all' && 'All'}
              {f === 'found' && <><Check className="w-3 h-3 mr-1" /> Found</>}
              {f === 'not_found' && <><X className="w-3 h-3 mr-1" /> Not Found</>}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* Sessions */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {sessions.map((session, index) => (
            <motion.div
              key={session.shopping_session_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="overflow-hidden">
                <button
                  onClick={() => handleExpandSession(session.shopping_session_id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {formatDate(session.ended_at)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {session.item_count} item{session.item_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="flex items-center gap-1 text-emerald-600">
                        <Check className="w-4 h-4" />
                        {session.found_count}
                      </span>
                      <span className="flex items-center gap-1 text-red-500">
                        <X className="w-4 h-4" />
                        {session.not_found_count}
                      </span>
                    </div>
                    {expandedSession === session.shopping_session_id ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </button>

                <AnimatePresence>
                  {expandedSession === session.shopping_session_id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <CardContent className="pt-0 pb-4 border-t">
                        <div className="space-y-2 pt-4">
                          {sessionItems[session.shopping_session_id]?.map((item) => (
                            <div
                              key={item.id}
                              className={cn(
                                'flex items-center justify-between p-3 rounded-lg',
                                item.status === 'found'
                                  ? 'bg-emerald-50'
                                  : 'bg-red-50'
                              )}
                            >
                              <div className="flex items-center gap-3">
                                {item.status === 'found' ? (
                                  <Check className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <X className="w-4 h-4 text-red-500" />
                                )}
                                <div>
                                  <span
                                    className={cn(
                                      'font-medium',
                                      item.status === 'found'
                                        ? 'text-emerald-700'
                                        : 'text-red-700'
                                    )}
                                  >
                                    {item.product_name}
                                  </span>
                                  {item.quantity > 1 && (
                                    <span className="text-sm text-muted-foreground ml-2">
                                      x{item.quantity}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRestore(item.id)}
                                className="gap-1"
                              >
                                <RotateCcw className="w-4 h-4" />
                                Restore
                              </Button>
                            </div>
                          )) || (
                            <div className="text-center py-4 text-muted-foreground">
                              Loading...
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Recent Items (when not viewing sessions) */}
      {filter !== 'all' && historyItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {filter === 'found' ? 'Recently Found' : 'Recently Not Found'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {historyItems.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg',
                    item.status === 'found' ? 'bg-emerald-50' : 'bg-red-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {item.status === 'found' ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <X className="w-4 h-4 text-red-500" />
                    )}
                    <span
                      className={cn(
                        'font-medium',
                        item.status === 'found' ? 'text-emerald-700' : 'text-red-700'
                      )}
                    >
                      {item.product_name}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRestore(item.id)}
                    className="gap-1"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

