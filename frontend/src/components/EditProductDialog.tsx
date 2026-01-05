import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
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

  // Load product and categories when dialog opens
  useEffect(() => {
    if (open && productId) {
      loadData();
    }
  }, [open, productId]);

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
              <Input
                id="product-name"
                value={product.name}
                onChange={(e) =>
                  setProduct({ ...product, name: e.target.value })
                }
              />
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

