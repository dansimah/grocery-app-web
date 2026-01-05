import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Trash2, Plus, Minus } from "lucide-react";
import { useGrocery } from "@/contexts/GroceryContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import EditProductDialog from "@/components/EditProductDialog";
import type { GroceryItem } from "@/lib/api";

interface ItemCardProps {
  item: GroceryItem;
}

// Long press hook
function useLongPress(callback: () => void, ms = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const start = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    timerRef.current = setTimeout(() => {
      callbackRef.current();
    }, ms);
  }, [ms]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
  };
}

export default function ItemCard({ item }: ItemCardProps) {
  const { updateItem, deleteItem, fetchItems } = useGrocery();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.quantity.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  // Product edit dialog state
  const [isProductEditOpen, setIsProductEditOpen] = useState(false);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleLongPress = useCallback(() => {
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    setIsProductEditOpen(true);
  }, []);

  const longPressHandlers = useLongPress(handleLongPress, 500);

  const handleQuantityChange = async (delta: number) => {
    const newQuantity = item.quantity + delta;
    if (newQuantity < 1) {
      handleDelete();
      return;
    }

    setIsUpdating(true);
    try {
      await updateItem(item.id, { quantity: newQuantity });
    } catch (error) {
      toast({
        title: "Failed to update",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
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
        title: "Failed to update",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
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
        title: "Failed to delete",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
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
        className="group flex items-center gap-2 px-2 py-2 rounded-lg border bg-white border-gray-200 transition-all hover:shadow-sm select-none"
      >
        {/* Item info - long press to edit product */}
        <div
          className="flex-1 min-w-0 cursor-pointer active:bg-muted/50 rounded px-1 -mx-1"
          {...longPressHandlers}
        >
          <span className="font-medium text-foreground truncate block text-sm">
            {item.product_name}
          </span>
        </div>

        {/* Quantity controls - compact */}
        <div className="flex items-center flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
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
                if (e.key === "Enter") handleQuantitySubmit();
                if (e.key === "Escape") {
                  setEditValue(item.quantity.toString());
                  setIsEditing(false);
                }
              }}
              className="w-8 h-7 text-center text-sm font-medium border rounded focus:outline-none focus:ring-2 focus:ring-primary"
            />
          ) : (
            <button
              onClick={() => {
                setEditValue(item.quantity.toString());
                setIsEditing(true);
              }}
              className="w-8 h-7 text-center text-sm font-medium tabular-nums hover:bg-muted rounded transition-colors"
            >
              {item.quantity}
            </button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
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
          className="h-7 w-7 text-muted-foreground hover:text-red-500 hover:bg-red-50 flex-shrink-0"
          onClick={handleDelete}
          aria-label="Delete item"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </motion.div>

      {/* Edit Product Dialog */}
      <EditProductDialog
        productId={item.product_id}
        open={isProductEditOpen}
        onOpenChange={setIsProductEditOpen}
        onSaved={fetchItems}
      />
    </>
  );
}
