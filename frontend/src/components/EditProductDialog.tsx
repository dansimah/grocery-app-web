import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, X, Sparkles, Loader2, SpellCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api, Product, Category, SpellSuggestResponse } from "@/lib/api";

interface EditProductDialogProps {
  productId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export default function EditProductDialog({
  productId,
  open,
  onOpenChange,
  onSaved,
}: EditProductDialogProps) {
  const { toast } = useToast();
  const [product, setProduct] = useState<(Product & { aliases?: string[] }) | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newAlias, setNewAlias] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFixingSpelling, setIsFixingSpelling] = useState(false);
  const [spellSuggestions, setSpellSuggestions] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load product and categories when dialog opens
  useEffect(() => {
    if (open && productId) {
      loadData();
      setSpellSuggestions([]);
    }
  }, [open, productId]);

  // Debounced spell check
  const checkSpelling = useCallback(async (name: string) => {
    if (!name || name.length < 2) {
      setSpellSuggestions([]);
      return;
    }

    try {
      const result = await api.getSpellSuggestions(name);
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

  // Trigger spell check when product name changes
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (product?.name) {
      debounceRef.current = setTimeout(() => {
        checkSpelling(product.name);
      }, 500); // 500ms debounce
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [product?.name, checkSpelling]);

  const loadData = async () => {
    if (!productId) return;
    
    setIsLoading(true);
    try {
      const [productData, categoriesData] = await Promise.all([
        api.getProduct(productId),
        api.getCategories(),
      ]);
      setProduct(productData);
      setCategories(categoriesData);
    } catch (error) {
      toast({
        title: "Failed to load product",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProduct = async () => {
    if (!product) return;
    try {
      await api.updateProduct(product.id, {
        name: product.name,
        category_id: product.category_id,
      });
      toast({ title: "Product updated" });
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast({
        title: "Failed to update",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const handleAddAlias = async () => {
    if (!product || !newAlias.trim()) return;
    try {
      const result = await api.addProductAlias(product.id, newAlias.trim());
      setProduct({ ...product, aliases: result.aliases });
      setNewAlias("");
      toast({ title: "Alias added" });
    } catch (error) {
      toast({ title: "Failed to add alias", variant: "destructive" });
    }
  };

  const handleRemoveAlias = async (alias: string) => {
    if (!product) return;
    try {
      const result = await api.removeProductAlias(product.id, alias);
      setProduct({ ...product, aliases: result.aliases });
      toast({ title: "Alias removed" });
    } catch (error) {
      toast({ title: "Failed to remove alias", variant: "destructive" });
    }
  };

  const handleFixSpelling = async () => {
    if (!product) return;
    setIsFixingSpelling(true);
    try {
      const result = await api.fixProductSpelling(product.id);
      setProduct({ ...product, name: result.name, aliases: result.aliases });
      setSpellSuggestions([]);
      
      if (result.corrected) {
        toast({ 
          title: "Spelling corrected",
          description: `"${result.originalName}" → "${result.name}"`,
        });
      } else {
        toast({ title: "No spelling changes needed" });
      }
    } catch (error) {
      toast({ 
        title: "Failed to fix spelling", 
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive" 
      });
    } finally {
      setIsFixingSpelling(false);
    }
  };

  const applySuggestion = (suggestion: string) => {
    if (!product) return;
    setProduct({ ...product, name: suggestion });
    setSpellSuggestions([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : product ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="product-name">Name</Label>
              <div className="flex gap-2">
                <Input
                  id="product-name"
                  value={product.name}
                  onChange={(e) =>
                    setProduct({ ...product, name: e.target.value })
                  }
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleFixSpelling}
                  disabled={isFixingSpelling}
                  title="Fix spelling with AI"
                  className="shrink-0"
                >
                  {isFixingSpelling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                </Button>
              </div>
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

            <div className="space-y-2">
              <Label htmlFor="product-category">Category</Label>
              <Select
                value={product.category_id.toString()}
                onValueChange={(value) =>
                  setProduct({
                    ...product,
                    category_id: parseInt(value),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.icon} {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Aliases (spelling variants)</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {product.aliases?.map((alias) => (
                  <span
                    key={alias}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-full text-sm"
                  >
                    {alias}
                    <button
                      onClick={() => handleRemoveAlias(alias)}
                      className="hover:text-red-500 active:scale-95"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add alias..."
                  value={newAlias}
                  onChange={(e) => setNewAlias(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddAlias()}
                />
                <Button onClick={handleAddAlias} size="icon" className="shrink-0">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpdateProduct} disabled={isLoading || !product}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

