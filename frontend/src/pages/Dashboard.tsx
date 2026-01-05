import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, Trash2, Package, Search } from 'lucide-react';
import { useGrocery } from '@/contexts/GroceryContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { api, Product } from '@/lib/api';
import CategorySection from '@/components/CategorySection';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function Dashboard() {
  const { grouped, categoryInfo, foundItems, isLoading, fetchItems, parseAndAdd, addItem, clearFound } = useGrocery();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  
  // Quick add with autocomplete
  const [quickAddText, setQuickAddText] = useState('');
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const quickAddRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search for products
  const searchProducts = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    setIsSearching(true);
    try {
      const products = await api.getProducts(undefined, query);
      setSuggestions(products.slice(0, 8));
      setShowSuggestions(products.length > 0);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleQuickAddChange = (value: string) => {
    setQuickAddText(value);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      searchProducts(value);
    }, 200);
  };

  const handleSelectProduct = async (product: Product) => {
    try {
      await addItem(product.id, 1);
      toast({ title: `Added ${product.name}` });
      setQuickAddText('');
      setSuggestions([]);
      setShowSuggestions(false);
      inputRef.current?.focus();
    } catch (error) {
      toast({
        title: 'Failed to add item',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  };

  const handleQuickAddSubmit = async () => {
    if (!quickAddText.trim()) return;
    
    setIsSearching(true);
    try {
      const stats = await parseAndAdd(quickAddText);
      toast({
        title: 'Item added!',
        description: stats.fromAI > 0 ? 'Parsed by AI' : 'Added from database',
      });
      setQuickAddText('');
      setSuggestions([]);
      setShowSuggestions(false);
    } catch (error) {
      toast({
        title: 'Failed to add item',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleQuickAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && showSuggestions) {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp' && showSuggestions) {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSelectProduct(suggestions[selectedIndex]);
      } else {
        // No selection - send to AI parser
        handleQuickAddSubmit();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (quickAddRef.current && !quickAddRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
          <Sparkles className="w-5 h-5" />
          AI Add
        </Button>
      </motion.div>

      {/* Quick Add with Autocomplete */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        ref={quickAddRef}
        className="relative"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Quick add item..."
            value={quickAddText}
            onChange={(e) => handleQuickAddChange(e.target.value)}
            onKeyDown={handleQuickAddKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            className="pl-9 pr-4"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
            </div>
          )}
        </div>
        
        {/* Suggestions dropdown */}
        <AnimatePresence>
          {showSuggestions && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg overflow-hidden"
            >
              {suggestions.map((product, index) => (
                <button
                  key={product.id}
                  onClick={() => handleSelectProduct(product)}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-muted transition-colors ${
                    index === selectedIndex ? 'bg-muted' : ''
                  }`}
                >
                  <span className="font-medium">{product.name}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <span>{product.category_icon}</span>
                    {product.category_name}
                  </span>
                </button>
              ))}
            </motion.div>
          )}
          {quickAddText.length >= 2 && !isSearching && suggestions.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg overflow-hidden"
            >
              <button
                onClick={handleQuickAddSubmit}
                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-muted transition-colors"
              >
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Add "<strong>{quickAddText}</strong>" with AI</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
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
                  <Sparkles className="w-4 h-4 mr-2" />
                  Parse & Add
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
