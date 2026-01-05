import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import { ShoppingCart, Check, Ban, ArrowLeft, ArrowRight, CheckCircle2, XCircle, RotateCcw, Undo2, Package } from 'lucide-react';
import { useGrocery } from '@/contexts/GroceryContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { GroceryItem, ItemStatus } from '@/lib/api';

interface UndoAction {
  itemId: number;
  previousStatus: ItemStatus;
  productName: string;
}

export default function Shopping() {
  const { activeItems, foundItems, fetchItems, updateStatus, completeShopping } = useGrocery();
  const { toast } = useToast();
  const [isCompleting, setIsCompleting] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Filter items by status
  const shoppingItems = activeItems.filter(
    item => item.status === 'pending' || item.status === 'selected'
  );
  const notFoundItems = activeItems.filter(item => item.status === 'not_found');

  // Group found items by category
  const foundByCategory = foundItems.reduce((acc, item) => {
    const cat = item.category_name;
    if (!acc[cat]) {
      acc[cat] = { icon: item.category_icon, items: [] };
    }
    acc[cat].items.push(item);
    return acc;
  }, {} as Record<string, { icon: string; items: GroceryItem[] }>);

  const totalItems = shoppingItems.length;
  const foundCount = foundItems.length;

  const handleStatusChange = useCallback(async (item: GroceryItem, newStatus: ItemStatus) => {
    // Save to undo stack
    setUndoStack(prev => [...prev, {
      itemId: item.id,
      previousStatus: item.status,
      productName: item.product_name,
    }]);
    
    await updateStatus(item.id, newStatus);
  }, [updateStatus]);

  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0) return;
    
    const lastAction = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    
    try {
      await updateStatus(lastAction.itemId, lastAction.previousStatus);
      toast({
        title: 'Undone',
        description: `Restored ${lastAction.productName}`,
      });
    } catch (error) {
      toast({
        title: 'Failed to undo',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  }, [undoStack, updateStatus, toast]);

  const handleRestore = useCallback(async (item: GroceryItem) => {
    try {
      await updateStatus(item.id, 'pending');
      toast({
        title: 'Restored',
        description: `${item.product_name} moved back to list`,
      });
    } catch (error) {
      toast({
        title: 'Failed to restore',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  }, [updateStatus, toast]);

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      const result = await completeShopping();
      setUndoStack([]); // Clear undo stack on complete
      toast({
        title: 'Shopping complete!',
        description: `Found ${result.foundCount} items, ${result.notFoundCount} not found`,
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: 'Failed to complete',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsCompleting(false);
    }
  };

  if (shoppingItems.length === 0 && notFoundItems.length === 0 && foundCount === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center">
          <ShoppingCart className="w-10 h-10 text-teal-600" />
        </div>
        <h3 className="text-xl font-heading font-semibold mb-2">Ready to shop?</h3>
        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
          Add items to your list first, then come back here for shopping mode.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-32">
      {/* Progress Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="w-10" /> {/* Spacer */}
          <h2 className="text-2xl font-heading font-bold text-foreground">Shopping Mode</h2>
          {/* Undo Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="relative"
            aria-label="Undo last action"
          >
            <Undo2 className="w-5 h-5" />
            {undoStack.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 text-xs bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                {undoStack.length}
              </span>
            )}
          </Button>
        </div>
        <p className="text-muted-foreground">
          Swipe right for found, left for not found
        </p>
        
        {/* Progress bar */}
        <div className="mt-4 max-w-xs mx-auto">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">{foundCount} found</span>
            <span className="text-muted-foreground">{totalItems} remaining</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${(foundCount / (foundCount + totalItems || 1)) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      </motion.div>

      {/* Swipe Instructions */}
      <div className="flex justify-center gap-8 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4 text-red-500" />
          <span>Not Found</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Found</span>
          <ArrowRight className="w-4 h-4 text-emerald-500" />
        </div>
      </div>

      {/* Shopping Items */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {shoppingItems.map((item, index) => (
            <SwipeableItem
              key={item.id}
              item={item}
              onSwipeLeft={() => handleStatusChange(item, 'not_found')}
              onSwipeRight={() => handleStatusChange(item, 'found')}
              index={index}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Not Found Section */}
      {notFoundItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-red-50 border-red-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <XCircle className="w-5 h-5 text-red-600" />
                <h3 className="font-heading font-semibold text-red-900">
                  Not Found ({notFoundItems.length})
                </h3>
              </div>
              <div className="space-y-2">
                {notFoundItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-red-100/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{item.category_icon || '📦'}</span>
                      <span className="text-red-700">
                        {item.product_name} {item.quantity > 1 && `(x${item.quantity})`}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRestore(item)}
                      className="text-red-600 hover:text-red-800 hover:bg-red-100"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Found Items Section (grouped by category) */}
      {foundItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-emerald-50 border-emerald-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Check className="w-5 h-5 text-emerald-600" />
                <h3 className="font-heading font-semibold text-emerald-900">
                  Found ({foundItems.length})
                </h3>
              </div>
              <div className="space-y-3">
                {Object.entries(foundByCategory).map(([category, { icon, items }]) => (
                  <Collapsible key={category} defaultOpen={false}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-100/50 hover:bg-emerald-100 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{icon || '📦'}</span>
                          <span className="font-medium text-emerald-800">{category}</span>
                        </div>
                        <span className="text-sm text-emerald-600">{items.length} items</span>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 space-y-1 pl-8">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-emerald-100/50"
                          >
                            <span className="text-emerald-700 line-through">
                              {item.product_name} {item.quantity > 1 && `(x${item.quantity})`}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRestore(item)}
                              className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100"
                              title="Restore to list"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Complete Shopping Button */}
      {(foundCount > 0 || notFoundItems.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-20 left-4 right-4 max-w-lg mx-auto"
        >
          <Button
            onClick={handleComplete}
            disabled={isCompleting}
            size="xl"
            className="w-full gap-2 shadow-lg"
            variant="success"
          >
            {isCompleting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                Completing...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Complete Shopping
              </>
            )}
          </Button>
        </motion.div>
      )}
    </div>
  );
}

// Swipeable Item Component
interface SwipeableItemProps {
  item: GroceryItem;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  index: number;
}

function SwipeableItem({ item, onSwipeLeft, onSwipeRight, index }: SwipeableItemProps) {
  const x = useMotionValue(0);
  const background = useTransform(
    x,
    [-100, 0, 100],
    ['rgb(254 202 202)', 'rgb(255 255 255)', 'rgb(209 250 229)']
  );
  const leftOpacity = useTransform(x, [-100, -50, 0], [1, 0.5, 0]);
  const rightOpacity = useTransform(x, [0, 50, 100], [0, 0.5, 1]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -100) {
      onSwipeLeft();
    } else if (info.offset.x > 100) {
      onSwipeRight();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 200 }}
      transition={{ delay: index * 0.05 }}
      className="relative"
    >
      {/* Background indicators */}
      <div className="absolute inset-0 flex items-center justify-between px-6 pointer-events-none">
        <motion.div style={{ opacity: leftOpacity }} className="flex items-center gap-2 text-red-500">
          <Ban className="w-6 h-6" />
          <span className="font-medium">Not Found</span>
        </motion.div>
        <motion.div style={{ opacity: rightOpacity }} className="flex items-center gap-2 text-emerald-500">
          <span className="font-medium">Found</span>
          <Check className="w-6 h-6" />
        </motion.div>
      </div>

      {/* Swipeable card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        onDragEnd={handleDragEnd}
        style={{ x, background }}
        className={cn(
          'relative p-4 rounded-xl border shadow-sm cursor-grab active:cursor-grabbing',
          item.status === 'selected' ? 'border-primary/30' : 'border-gray-200'
        )}
      >
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center text-2xl',
              item.status === 'selected' ? 'bg-primary/10' : 'bg-muted'
            )}
          >
            {item.category_icon || <Package className="w-6 h-6 text-muted-foreground" />}
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-foreground">{item.product_name}</h3>
            <p className="text-sm text-muted-foreground">
              {item.category_name}
              {item.quantity > 1 && ` • x${item.quantity}`}
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
