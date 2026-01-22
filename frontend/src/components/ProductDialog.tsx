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
import { api, Product, Category } from "@/lib/api";

interface ProductDialogProps {
  mode: 'create' | 'edit';
  productId?: number | null;       // Required for edit mode
  initialCategoryId?: number;      // Optional pre-selection for create
  initialName?: string;            // Optional pre-fill for create (from search)
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (product: Product) => void;
  categories?: Category[];         // Optional - avoid refetching if parent has them
}

export default function ProductDialog({
  mode,
  productId,
  initialCategoryId,
  initialName = "",
  open,
  onOpenChange,
  onSaved,
  categories: propCategories,
}: ProductDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [aliases, setAliases] = useState<string[]>([]);
  const [newAlias, setNewAlias] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFixingSpelling, setIsFixingSpelling] = useState(false);
  const [spellSuggestions, setSpellSuggestions] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isEditMode = mode === 'edit';

  // Reset and load data when dialog opens
  useEffect(() => {
    if (open) {
      setSpellSuggestions([]);
      setNewAlias("");
      
      if (isEditMode && productId) {
        loadEditData();
      } else {
        // Create mode - initialize with props or empty
        setName(initialName);
        setCategoryId(initialCategoryId ?? null);
        setAliases([]);
        setIsLoading(false);
        
        // Load categories if not provided
        if (propCategories && propCategories.length > 0) {
          setCategories(propCategories);
        } else {
          loadCategories();
        }
      }
    }
  }, [open, mode, productId, initialName, initialCategoryId, propCategories]);

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

  const loadCategories = async () => {
    try {
      const categoriesData = await api.getCategories();
      setCategories(categoriesData);
    } catch (error) {
      toast({
        title: "Failed to load categories",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const loadEditData = async () => {
    if (!productId) return;
    
    setIsLoading(true);
    try {
      const fetchCategories = !propCategories || propCategories.length === 0;
      const [productData, categoriesData] = await Promise.all([
        api.getProduct(productId),
        fetchCategories ? api.getCategories() : Promise.resolve(propCategories!),
      ]);
      
      setName(productData.name);
      setCategoryId(productData.category_id);
      setAliases(productData.aliases || []);
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

  const handleSave = async () => {
    if (!name.trim() || !categoryId) return;
    
    setIsSaving(true);
    try {
      let savedProduct: Product;
      
      if (isEditMode && productId) {
        // Update existing product
        savedProduct = await api.updateProduct(productId, {
          name: name.trim(),
          category_id: categoryId,
        });
        toast({ title: "Product updated" });
      } else {
        // Create new product (include aliases if any were added)
        savedProduct = await api.createProduct(name.trim(), categoryId, aliases.length > 0 ? aliases : undefined);
        toast({ title: "Product created" });
      }
      
      onOpenChange(false);
      onSaved?.(savedProduct);
    } catch (error) {
      toast({
        title: isEditMode ? "Failed to update" : "Failed to create",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddAlias = async () => {
    if (!newAlias.trim()) return;
    
    const trimmedAlias = newAlias.trim();
    
    // Check for duplicates
    if (aliases.some(a => a.toLowerCase() === trimmedAlias.toLowerCase())) {
      toast({ title: "Alias already exists", variant: "destructive" });
      return;
    }
    
    if (isEditMode && productId) {
      // Edit mode: persist to server
      try {
        const result = await api.addProductAlias(productId, trimmedAlias);
        setAliases(result.aliases);
        setNewAlias("");
        toast({ title: "Alias added" });
      } catch {
        toast({ title: "Failed to add alias", variant: "destructive" });
      }
    } else {
      // Create mode: just update local state
      setAliases([...aliases, trimmedAlias]);
      setNewAlias("");
    }
  };

  const handleRemoveAlias = async (alias: string) => {
    if (isEditMode && productId) {
      // Edit mode: persist to server
      try {
        const result = await api.removeProductAlias(productId, alias);
        setAliases(result.aliases);
        toast({ title: "Alias removed" });
      } catch {
        toast({ title: "Failed to remove alias", variant: "destructive" });
      }
    } else {
      // Create mode: just update local state
      setAliases(aliases.filter(a => a !== alias));
    }
  };

  const handleFixSpelling = async () => {
    if (!productId) return;
    setIsFixingSpelling(true);
    try {
      const result = await api.fixProductSpelling(productId);
      setName(result.name);
      setAliases(result.aliases);
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

  const applySuggestion = async (suggestion: string) => {
    const oldName = name;
    setName(suggestion);
    setSpellSuggestions([]);
    
    // In edit mode, add the old (wrong) spelling as an alias
    if (isEditMode && productId && oldName.trim() && oldName.trim().toLowerCase() !== suggestion.toLowerCase()) {
      try {
        const result = await api.addProductAlias(productId, oldName.trim());
        setAliases(result.aliases);
        toast({ 
          title: "Spelling corrected",
          description: `"${oldName}" added as alias`,
        });
      } catch {
        // Silently fail - alias addition is optional
      }
    }
  };

  const canSave = name.trim().length > 0 && categoryId !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Product" : "Add Product"}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Name field with spell suggestions */}
            <div className="space-y-2">
              <Label htmlFor="product-name">Name</Label>
              <div className="flex gap-2">
                <Input
                  id="product-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Milk"
                  className="flex-1"
                  autoFocus={!isEditMode}
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
              {/* Spell suggestions - works in both modes */}
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

            {/* Category selector */}
            <div className="space-y-2">
              <Label htmlFor="product-category">Category</Label>
              <Select
                value={categoryId?.toString() ?? ""}
                onValueChange={(value) => setCategoryId(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category..." />
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

            {/* Aliases section - only in edit mode */}
              <div className="space-y-2">
                <Label>Aliases (spelling variants)</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {aliases.map((alias) => (
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
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || isSaving || !canSave}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isEditMode ? "Saving..." : "Creating..."}
              </>
            ) : (
              isEditMode ? "Save Changes" : "Create Product"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
