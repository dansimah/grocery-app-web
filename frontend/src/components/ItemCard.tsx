import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Edit2, Trash2, ArrowRight, Ban, Plus, Minus } from 'lucide-react';
import { useGrocery } from '@/contexts/GroceryContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { GroceryItem, ItemStatus } from '@/lib/api';

interface ItemCardProps {
  item: GroceryItem;
  showActions?: boolean;
}

const statusStyles: Record<ItemStatus, { bg: string; border: string; text: string }> = {
  pending: { bg: 'bg-white', border: 'border-gray-200', text: 'text-foreground' },
  selected: { bg: 'bg-primary/5', border: 'border-primary/30', text: 'text-primary' },
  found: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  not_found: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
};

export default function ItemCard({ item, showActions = true }: ItemCardProps) {
  const { updateStatus, updateItem, deleteItem } = useGrocery();
  const { toast } = useToast();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editQuantity, setEditQuantity] = useState(item.quantity.toString());
  const [editNote, setEditNote] = useState(item.note || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isQuantityUpdating, setIsQuantityUpdating] = useState(false);

  const handleQuantityChange = async (delta: number) => {
    const newQuantity = item.quantity + delta;
    if (newQuantity < 1) return;
    
    setIsQuantityUpdating(true);
    try {
      await updateItem(item.id, { quantity: newQuantity });
    } catch (error) {
      toast({
        title: 'Failed to update',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsQuantityUpdating(false);
    }
  };

  const style = statusStyles[item.status];

  const handleStatusChange = async (newStatus: ItemStatus) => {
    try {
      await updateStatus(item.id, newStatus);
    } catch (error) {
      toast({
        title: 'Failed to update',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = async () => {
    setIsUpdating(true);
    try {
      await updateItem(item.id, {
        quantity: parseInt(editQuantity) || 1,
        note: editNote || undefined,
      });
      setIsEditOpen(false);
      toast({ title: 'Item updated' });
    } catch (error) {
      toast({
        title: 'Failed to update',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteItem(item.id);
      toast({ title: 'Item deleted' });
    } catch (error) {
      toast({
        title: 'Failed to delete',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className={cn(
          'group flex items-center gap-3 p-3 rounded-xl border transition-all',
          style.bg,
          style.border
        )}
      >
        {/* Status indicator */}
        <button
          onClick={() => handleStatusChange(item.status === 'selected' ? 'pending' : 'selected')}
          className={cn(
            'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
            item.status === 'selected'
              ? 'border-primary bg-primary'
              : 'border-gray-300 hover:border-primary'
          )}
        >
          {item.status === 'selected' && <ArrowRight className="w-3 h-3 text-white" />}
        </button>

        {/* Item info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('font-medium truncate', style.text)}>
              {item.product_name}
            </span>
          </div>
          {item.note && (
            <p className="text-xs text-muted-foreground truncate">{item.note}</p>
          )}
        </div>

        {/* Quantity controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => handleQuantityChange(-1)}
            disabled={item.quantity <= 1 || isQuantityUpdating}
            aria-label="Decrease quantity"
          >
            <Minus className="w-3 h-3" />
          </Button>
          <span className="w-6 text-center text-sm font-medium tabular-nums">
            {item.quantity}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => handleQuantityChange(1)}
            disabled={isQuantityUpdating}
            aria-label="Increase quantity"
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>

        {/* Actions - visible on mobile, enhanced on hover for desktop */}
        {showActions && (
          <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 active:scale-95 active:bg-emerald-100"
              onClick={() => handleStatusChange('found')}
              aria-label="Mark as found"
            >
              <Check className="w-5 h-5 text-emerald-600" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 active:scale-95 active:bg-red-100"
              onClick={() => handleStatusChange('not_found')}
              aria-label="Mark as not found"
            >
              <Ban className="w-5 h-5 text-red-500" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 active:scale-95"
              onClick={() => setIsEditOpen(true)}
              aria-label="Edit item"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 active:scale-95 active:bg-red-100"
              onClick={handleDelete}
              aria-label="Delete item"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        )}
      </motion.div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Product</Label>
              <p className="font-medium">{item.product_name}</p>
              <p className="text-sm text-muted-foreground">{item.category_name}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Input
                id="note"
                placeholder="Add a note..."
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={isUpdating}>
              {isUpdating ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
