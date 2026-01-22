import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, Plus, X, ShoppingCart, Check, UtensilsCrossed } from 'lucide-react';
import { api, Meal, DayPlan, MenuProduct, GroceryItem } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import { cn } from '@/lib/utils';

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getToday(): string {
  return formatLocalDate(new Date());
}

function formatDateRange(startDate: string): string {
  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
}

function getDayInfo(startDate: string, dayOffset: number): { dayName: string; dateStr: string; fullDate: string } {
  const date = new Date(startDate + 'T12:00:00');
  date.setDate(date.getDate() + dayOffset);
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const fullDate = formatLocalDate(date);
  return { dayName, dateStr, fullDate };
}

export default function MenuPlanner() {
  const [startDate, setStartDate] = useState(getToday());
  const [plan, setPlan] = useState<Record<number, DayPlan>>({});
  const [meals, setMeals] = useState<Meal[]>([]);
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isMealDialogOpen, setIsMealDialogOpen] = useState(false);
  const [isProductsDialogOpen, setIsProductsDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<'lunch' | 'dinner'>('dinner');
  const [isAddingToGroceries, setIsAddingToGroceries] = useState(false);
  const [groceryProductIds, setGroceryProductIds] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [startDate]);

  const loadData = async () => {
    try {
      const [planData, mealsData, productsData, groceriesData] = await Promise.all([
        api.getMenuPlan(startDate),
        api.getMeals(),
        api.getMenuProducts(startDate),
        api.getGroceries(),
      ]);
      setPlan(planData.plan);
      setMeals(mealsData);
      setProducts(productsData);
      // Don't select any by default
      setSelectedProducts(new Set());
      // Track which products are already in grocery list
      const groceryIds = new Set(groceriesData.allItems.map((item: GroceryItem) => item.product_id));
      setGroceryProductIds(groceryIds);
    } catch (error) {
      toast({
        title: 'Failed to load menu plan',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevWeek = () => {
    const prev = new Date(startDate + 'T12:00:00');
    prev.setDate(prev.getDate() - 7);
    setStartDate(formatLocalDate(prev));
  };

  const handleNextWeek = () => {
    const next = new Date(startDate + 'T12:00:00');
    next.setDate(next.getDate() + 7);
    setStartDate(formatLocalDate(next));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setStartDate(e.target.value);
    }
  };

  const handleOpenMealDialog = (dayIndex: number, mealType: 'lunch' | 'dinner') => {
    setSelectedDay(dayIndex);
    setSelectedMealType(mealType);
    setIsMealDialogOpen(true);
  };

  const handleAddMeal = async (mealId: number) => {
    if (selectedDay === null) return;
    try {
      const result = await api.addMealToDay(startDate, selectedDay, selectedMealType, mealId);
      setPlan(result.plan);
      // Refresh products
      const productsData = await api.getMenuProducts(startDate);
      setProducts(productsData);
      setIsMealDialogOpen(false);
    } catch (error) {
      toast({ title: 'Failed to add meal', variant: 'destructive' });
    }
  };

  const handleRemoveMeal = async (planItemId: number) => {
    try {
      await api.removeMealFromDay(planItemId);
      // Refresh plan
      const planData = await api.getMenuPlan(startDate);
      setPlan(planData.plan);
      // Refresh products
      const productsData = await api.getMenuProducts(startDate);
      setProducts(productsData);
    } catch (error) {
      toast({ title: 'Failed to remove meal', variant: 'destructive' });
    }
  };

  const toggleProduct = (productId: number) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedProducts(new Set(products.map(p => p.id)));
  };

  const handleSelectNotInList = () => {
    setSelectedProducts(new Set(products.filter(p => !groceryProductIds.has(p.id)).map(p => p.id)));
  };

  const handleDeselectAll = () => {
    setSelectedProducts(new Set());
  };

  const handleOpenProductsDialog = async () => {
    // Refresh grocery list when opening
    try {
      const groceriesData = await api.getGroceries();
      setGroceryProductIds(new Set(groceriesData.allItems.map((item: GroceryItem) => item.product_id)));
    } catch (error) {
      // Continue even if refresh fails
    }
    setIsProductsDialogOpen(true);
  };

  const handleAddToGroceries = async () => {
    if (selectedProducts.size === 0) return;
    setIsAddingToGroceries(true);
    try {
      const result = await api.addProductsToGroceries(Array.from(selectedProducts));
      toast({
        title: 'Added to grocery list',
        description: `${result.addedCount} added, ${result.skippedCount} already in list`,
      });
      // Clear selection and refresh grocery list status
      setSelectedProducts(new Set());
      const groceriesData = await api.getGroceries();
      setGroceryProductIds(new Set(groceriesData.allItems.map((item: GroceryItem) => item.product_id)));
      setIsProductsDialogOpen(false);
    } catch (error) {
      toast({ title: 'Failed to add products', variant: 'destructive' });
    } finally {
      setIsAddingToGroceries(false);
    }
  };

  // Group products by category
  const groupedProducts = useMemo(() => {
    const groups: Record<string, MenuProduct[]> = {};
    for (const product of products) {
      const category = product.category_name || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(product);
    }
    return groups;
  }, [products]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-2xl font-heading font-bold text-foreground">Menu Planner</h2>
        <p className="text-muted-foreground">
          Plan your meals and add ingredients to your grocery list
        </p>
      </motion.div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" onClick={handlePrevWeek}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">{formatDateRange(startDate)}</span>
          <input
            type="date"
            value={startDate}
            onChange={handleDateChange}
            className="text-sm border rounded px-2 py-1 bg-background"
          />
        </div>
        <Button variant="outline" size="icon" onClick={handleNextWeek}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Week Grid */}
      <div className="grid gap-3">
        {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
          const { dayName, dateStr } = getDayInfo(startDate, dayOffset);
          const dayPlan = plan[dayOffset] || { lunch: [], dinner: [] };
          return (
            <Card key={dayOffset} className="p-3">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-medium text-sm">{dayName}</span>
                <span className="text-xs text-muted-foreground">{dateStr}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {/* Lunch */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Lunch</span>
                    <button
                      onClick={() => handleOpenMealDialog(dayOffset, 'lunch')}
                      className="text-muted-foreground hover:text-primary"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {dayPlan.lunch.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-1.5 text-xs bg-amber-50 text-amber-800 rounded px-2 py-1"
                    >
                      <UtensilsCrossed className="w-3 h-3 shrink-0" />
                      <span className="truncate flex-1">{item.meal_name}</span>
                      <button
                        onClick={() => handleRemoveMeal(item.id)}
                        className="text-amber-600 hover:text-red-600 shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {dayPlan.lunch.length === 0 && (
                    <div className="text-xs text-muted-foreground italic">-</div>
                  )}
                </div>
                {/* Dinner */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Dinner</span>
                    <button
                      onClick={() => handleOpenMealDialog(dayOffset, 'dinner')}
                      className="text-muted-foreground hover:text-primary"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {dayPlan.dinner.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary rounded px-2 py-1"
                    >
                      <UtensilsCrossed className="w-3 h-3 shrink-0" />
                      <span className="truncate flex-1">{item.meal_name}</span>
                      <button
                        onClick={() => handleRemoveMeal(item.id)}
                        className="text-primary/70 hover:text-red-600 shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {dayPlan.dinner.length === 0 && (
                    <div className="text-xs text-muted-foreground italic">-</div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Floating Shopping Cart Button */}
      {products.length > 0 && (
        <button
          onClick={handleOpenProductsDialog}
          className="fixed bottom-24 right-4 z-30 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
        >
          <ShoppingCart className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-6 h-6 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {products.length}
          </span>
        </button>
      )}

      {/* Products Dialog */}
      <Dialog open={isProductsDialogOpen} onOpenChange={setIsProductsDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Products Needed ({products.length})
            </DialogTitle>
          </DialogHeader>

          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleSelectNotInList}>
              Select New
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDeselectAll}>
              Clear
            </Button>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-3 pr-4">
              {Object.entries(groupedProducts).map(([category, categoryProducts]) => (
                <div key={category}>
                  <div className="text-xs font-medium text-muted-foreground px-1 py-1 sticky top-0 bg-background">
                    {categoryProducts[0]?.category_icon} {category}
                  </div>
                  <div className="space-y-0.5">
                    {categoryProducts.map(product => {
                      const isSelected = selectedProducts.has(product.id);
                      const isInList = groceryProductIds.has(product.id);
                      return (
                        <button
                          key={product.id}
                          onClick={() => toggleProduct(product.id)}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors text-sm",
                            isSelected
                              ? "bg-primary/10 text-primary"
                              : isInList
                              ? "bg-muted/50 text-muted-foreground"
                              : "hover:bg-muted"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className={cn("font-medium", isInList && !isSelected && "line-through")}>{product.name}</span>
                            {isInList && (
                              <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                                in list
                              </span>
                            )}
                          </div>
                          {isSelected && <Check className="w-4 h-4" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="pt-4 border-t">
            <Button
              className="w-full gap-2"
              onClick={handleAddToGroceries}
              disabled={selectedProducts.size === 0 || isAddingToGroceries}
            >
              <ShoppingCart className="w-4 h-4" />
              {isAddingToGroceries ? 'Adding...' : `Add ${selectedProducts.size} to Grocery List`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Meal Selection Dialog */}
      <Dialog open={isMealDialogOpen} onOpenChange={setIsMealDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Add {selectedMealType === 'lunch' ? 'Lunch' : 'Dinner'} - {selectedDay !== null ? (() => {
                const { dayName, dateStr } = getDayInfo(startDate, selectedDay);
                return `${dayName}, ${dateStr}`;
              })() : ''}
            </DialogTitle>
          </DialogHeader>
          
          {meals.length > 0 ? (
            <ScrollArea className="h-[300px]">
              <div className="space-y-1 p-1">
                {meals.map(meal => (
                  <button
                    key={meal.id}
                    onClick={() => handleAddMeal(meal.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left hover:bg-muted transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <UtensilsCrossed className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{meal.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {meal.product_count} products
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <UtensilsCrossed className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No meals created yet.</p>
              <p className="text-sm">Go to Meals tab to create some!</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMealDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
