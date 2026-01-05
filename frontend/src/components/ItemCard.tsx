import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Plus, Minus, Package } from 'lucide-react';
import { useGrocery } from '@/contexts/GroceryContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { GroceryItem } from '@/lib/api';

interface ItemCardProps {
  item: GroceryItem;
}

export default function ItemCard({ item }: ItemCardProps) {
  const { updateItem, deleteItem } = useGrocery();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.quantity.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleQuantityChange = async (delta: number) => {
    const newQuantity = item.quantity + delta;
    if (newQuantity < 1) {
      // Delete if quantity goes to 0
      handleDelete();
      return;
    }
    
    setIsUpdating(true);
    try {
      await updateItem(item.id, { quantity: newQuantity });
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

  const handleQuantitySubmit = async () => {
    const newQuantity = parseInt(editValue) || 1;
    setIsEditing(false);
    
    if (newQuantity === item.quantity) return;
    if (newQuantity < 1) {
      handleDelete();
      return;
    }

    setIsUpdating(true);
    try {
      await updateItem(item.id, { quantity: newQuantity });
    } catch (error) {
      toast({
        title: 'Failed to update',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
      setEditValue(item.quantity.toString());
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteItem(item.id);
    } catch (error) {
      toast({
        title: 'Failed to delete',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="group flex items-center gap-3 p-3 rounded-xl border bg-white border-gray-200 transition-all hover:shadow-sm"
    >
      {/* Category Icon */}
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-lg flex-shrink-0">
        {item.category_icon || <Package className="w-5 h-5 text-muted-foreground" />}
      </div>

      {/* Item info */}
      <div className="flex-1 min-w-0">
        <span className="font-medium text-foreground truncate block">
          {item.product_name}
        </span>
      </div>

      {/* Quantity controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => handleQuantityChange(-1)}
          disabled={isUpdating}
          aria-label="Decrease quantity"
        >
          <Minus className="w-3 h-3" />
        </Button>
        
        {isEditing ? (
          <input
            ref={inputRef}
            type="number"
            min="1"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleQuantitySubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleQuantitySubmit();
              if (e.key === 'Escape') {
                setEditValue(item.quantity.toString());
                setIsEditing(false);
              }
            }}
            className="w-10 h-8 text-center text-sm font-medium border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        ) : (
          <button
            onClick={() => {
              setEditValue(item.quantity.toString());
              setIsEditing(true);
            }}
            className="w-10 h-8 text-center text-sm font-medium tabular-nums hover:bg-muted rounded-md transition-colors"
          >
            {item.quantity}
          </button>
        )}
        
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => handleQuantityChange(1)}
          disabled={isUpdating}
          aria-label="Increase quantity"
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-opacity",
          "opacity-0 group-hover:opacity-100 focus:opacity-100"
        )}
        onClick={handleDelete}
        aria-label="Delete item"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </motion.div>
  );
}
