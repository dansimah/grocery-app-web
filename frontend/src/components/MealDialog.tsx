import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Search, Check, Plus, SpellCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Product, MealWithProducts, Category } from '@/lib/api';
import ProductDialog from './ProductDialog';

interface MealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meal: MealWithProducts | null;
  products: Product[];
  categories: Category[];
  onSave: (name: string, productIds: number[]) => Promise<void>;
  onProductCreated: (product: Product) => void;
}

export default function MealDialog({
  open,
  onOpenChange,
  meal,
  products,
  categories,
  onSave,
  onProductCreated,
}: MealDialogProps) {
  const [name, setName] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [spellSuggestions, setSpellSuggestions] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Product dialog state
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [newProductInitialName, setNewProductInitialName] = useState('');

  // Reset form when dialog opens/closes or meal changes
  useEffect(() => {
    if (open) {
      if (meal) {
        setName(meal.name);
        setSelectedProductIds(new Set(meal.products.map(p => p.id)));
      } else {
        setName('');
        setSelectedProductIds(new Set());
      }
      setSearchQuery('');
      setShowProductDialog(false);
      setNewProductInitialName('');
      setSpellSuggestions([]);
    }
  }, [open, meal]);

  // Debounced spell check
  const checkSpelling = useCallback(async (text: string) => {
    if (!text || text.length < 2) {
      setSpellSuggestions([]);
      return;
    }

    try {
      const result = await api.getSpellSuggestions(text);
      if (result.available && result.combinedSuggestions.length > 0) {
        setSpellSuggestions(result.combinedSuggestions);
      } else {
        setSpellSuggestions([]);
      }
    } catch {
      // Silently fail - spell check is optional
      setSpellSuggestions([]);
    }
  }, []);

  // Trigger spell check when name changes
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (name && name.length >= 2 && open) {
      debounceRef.current = setTimeout(() => {
        checkSpelling(name);
      }, 500); // 500ms debounce
    } else {
      setSpellSuggestions([]);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [name, checkSpelling, open]);

  const applySuggestion = (suggestion: string) => {
    setName(suggestion);
    setSpellSuggestions([]);
  };

  // Filter products by search query (includes aliases)
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(query) ||
      p.category_name?.toLowerCase().includes(query) ||
      p.aliases?.some(alias => alias.toLowerCase().includes(query))
    );
  }, [products, searchQuery]);

  // Group products by category
  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    for (const product of filteredProducts) {
      const category = product.category_name || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(product);
    }
    return groups;
  }, [filteredProducts]);

  const toggleProduct = (productId: number) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await onSave(name.trim(), Array.from(selectedProductIds));
    } finally {
      setIsSaving(false);
    }
  };

  const openNewProductDialog = () => {
    setNewProductInitialName(searchQuery.trim());
    setShowProductDialog(true);
  };

  const handleProductCreated = (product: Product) => {
    // Add the new product to selected products
    setSelectedProductIds(prev => new Set([...prev, product.id]));
    // Notify parent to refresh products list
    onProductCreated(product);
    // Clear search
    setSearchQuery('');
  };

  const selectedProducts = products.filter(p => selectedProductIds.has(p.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{meal ? 'Edit Meal' : 'Add Meal'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0 flex flex-col">
          {/* Meal Name */}
          <div className="space-y-2">
            <Label htmlFor="meal-name">Name</Label>
            <Input
              id="meal-name"
              placeholder="e.g., Pasta Carbonara"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            {/* Spell suggestions */}
            {spellSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <SpellCheck className="w-3.5 h-3.5 text-amber-500 mt-1" />
                {spellSuggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => applySuggestion(suggestion)}
                    className="px-2 py-0.5 text-sm bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Products */}
          {selectedProducts.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Products ({selectedProducts.length})</Label>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {selectedProducts.map(product => (
                  <button
                    key={product.id}
                    onClick={() => toggleProduct(product.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-sm hover:bg-primary/20 transition-colors"
                  >
                    <span>{product.category_icon}</span>
                    <span>{product.name}</span>
                    <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Product Search */}
          <div className="space-y-2 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between">
              <Label>Add Products</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={openNewProductDialog}
              >
                <Plus className="w-3 h-3" />
                New Product
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Product List */}
            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-2 space-y-3">
                {Object.entries(groupedProducts).map(([category, categoryProducts]) => (
                  <div key={category}>
                    <div className="text-xs font-medium text-muted-foreground px-2 py-1 sticky top-0 bg-background">
                      {categoryProducts[0]?.category_icon} {category}
                    </div>
                    <div className="space-y-0.5">
                      {categoryProducts.map(product => {
                        const isSelected = selectedProductIds.has(product.id);
                        return (
                          <button
                            key={product.id}
                            onClick={() => toggleProduct(product.id)}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors",
                              isSelected
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-muted"
                            )}
                          >
                            <span className="font-medium">{product.name}</span>
                            {isSelected && <Check className="w-4 h-4" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {Object.keys(groupedProducts).length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <p>No products found</p>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="mt-1"
                      onClick={openNewProductDialog}
                    >
                      Create "{searchQuery.trim()}"
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!name.trim() || isSaving}
          >
            {isSaving ? 'Saving...' : meal ? 'Save Changes' : 'Create Meal'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Product Dialog for creating new products */}
      <ProductDialog
        mode="create"
        open={showProductDialog}
        onOpenChange={setShowProductDialog}
        onSaved={handleProductCreated}
        initialName={newProductInitialName}
        categories={categories}
      />
    </Dialog>
  );
}
