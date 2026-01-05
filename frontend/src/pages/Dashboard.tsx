import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Sparkles, Check, Trash2, Package } from 'lucide-react';
import { useGrocery } from '@/contexts/GroceryContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import CategorySection from '@/components/CategorySection';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function Dashboard() {
  const { grouped, categoryInfo, foundItems, isLoading, fetchItems, parseAndAdd, clearFound } = useGrocery();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAddItems = async () => {
    if (!inputText.trim()) return;
    
    setIsParsing(true);
    try {
      const stats = await parseAndAdd(inputText);
      toast({
        title: 'Items added!',
        description: `Added ${stats.total} items (${stats.fromCache} from database, ${stats.fromAI} parsed by AI)`,
        variant: 'success',
      });
      setInputText('');
      setIsAddDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Failed to add items',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleClearFound = async () => {
    try {
      await clearFound();
      toast({
        title: 'Cleared',
        description: 'Found items have been removed',
      });
    } catch (error) {
      toast({
        title: 'Failed to clear',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  };

  const categories = Object.keys(grouped);
  const totalItems = categories.reduce((acc, cat) => acc + grouped[cat].length, 0);

  if (isLoading && totalItems === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Stats Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Your List</h2>
          <p className="text-muted-foreground">
            {totalItems === 0 ? 'No items yet' : `${totalItems} item${totalItems !== 1 ? 's' : ''} to get`}
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} size="lg" className="gap-2">
          <Plus className="w-5 h-5" />
          Add Items
        </Button>
      </motion.div>

      {/* Empty State */}
      {totalItems === 0 && foundItems.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-16"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center">
            <Package className="w-10 h-10 text-teal-600" />
          </div>
          <h3 className="text-xl font-heading font-semibold mb-2">Your list is empty</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Add items by typing them naturally. Our AI will understand and categorize them for you.
          </p>
          <Button onClick={() => setIsAddDialogOpen(true)} size="lg" className="gap-2">
            <Sparkles className="w-5 h-5" />
            Add Your First Items
          </Button>
        </motion.div>
      )}

      {/* Category Sections */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {categories.map((category, index) => (
            <motion.div
              key={category}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.05 }}
            >
              <CategorySection 
                category={category} 
                items={grouped[category]} 
                icon={categoryInfo[category]?.icon}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Found Items Section */}
      {foundItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-emerald-50 border-emerald-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-heading font-semibold text-emerald-900">
                    Found Items ({foundItems.length})
                  </h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFound}
                  className="text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              </div>
              <div className="space-y-2">
                {foundItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-emerald-100/50"
                  >
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="line-through text-emerald-700">
                      {item.product_name} {item.quantity > 1 && `(x${item.quantity})`}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Add Items Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Add Items
            </DialogTitle>
            <DialogDescription>
              Type your grocery items naturally. Our AI will parse and categorize them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="items">Items (one per line)</Label>
              <textarea
                id="items"
                className="flex min-h-[150px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                placeholder="2 pommes&#10;Pain complet&#10;Lait&#10;Fromage râpé"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Tip: You can include quantities like "2 pommes" or "pain x3"
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddItems} disabled={isParsing || !inputText.trim()}>
              {isParsing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Parsing...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Items
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
