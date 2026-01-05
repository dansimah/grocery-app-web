import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { GroceryItem } from '@/lib/api';
import ItemCard from './ItemCard';

interface CategorySectionProps {
  category: string;
  items: GroceryItem[];
  icon?: string;
}

export default function CategorySection({ category, items, icon }: CategorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Get icon from first item if not provided
  const categoryIcon = icon || items[0]?.category_icon || '📦';

  const pendingCount = items.filter(i => i.status === 'pending').length;
  const selectedCount = items.filter(i => i.status === 'selected').length;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xl">
            {categoryIcon}
          </span>
          <div className="text-left">
            <h3 className="font-heading font-semibold text-foreground">
              {category}
            </h3>
            <p className="text-xs text-muted-foreground">
              {items.length} item{items.length !== 1 ? 's' : ''}
              {selectedCount > 0 && ` • ${selectedCount} selected`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full">
              {pendingCount}
            </span>
          )}
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="pt-0 pb-3 px-3">
              <div className="space-y-2">
                {items.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
