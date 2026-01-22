import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { UtensilsCrossed, Plus, Edit2, Trash2, Package } from 'lucide-react';
import { api, Meal, MealWithProducts, Product, Category } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import MealDialog from '@/components/MealDialog';

export default function Meals() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<MealWithProducts | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [mealsData, productsData, categoriesData] = await Promise.all([
        api.getMeals(),
        api.getProducts(),
        api.getCategories(),
      ]);
      setMeals(mealsData);
      setProducts(productsData);
      setCategories(categoriesData);
    } catch (error) {
      toast({
        title: 'Failed to load meals',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleProductCreated = (newProduct: Product) => {
    // Add the new product to the list
    setProducts(prev => [...prev, newProduct].sort((a, b) => a.name.localeCompare(b.name)));
    toast({ title: `Product "${newProduct.name}" created` });
  };

  const handleCreateMeal = () => {
    setEditingMeal(null);
    setIsDialogOpen(true);
  };

  const handleEditMeal = async (mealId: number) => {
    try {
      const meal = await api.getMeal(mealId);
      setEditingMeal(meal);
      setIsDialogOpen(true);
    } catch (error) {
      toast({
        title: 'Failed to load meal',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteMeal = async (mealId: number, mealName: string) => {
    if (!confirm(`Delete "${mealName}"? This cannot be undone.`)) return;
    
    try {
      await api.deleteMeal(mealId);
      toast({ title: 'Meal deleted' });
      loadData();
    } catch (error) {
      toast({
        title: 'Failed to delete meal',
        variant: 'destructive',
      });
    }
  };

  const handleSaveMeal = async (name: string, productIds: number[]) => {
    try {
      if (editingMeal) {
        await api.updateMeal(editingMeal.id, name, productIds);
        toast({ title: 'Meal updated' });
      } else {
        await api.createMeal(name, productIds);
        toast({ title: 'Meal created' });
      }
      setIsDialogOpen(false);
      loadData();
    } catch (error) {
      toast({
        title: editingMeal ? 'Failed to update meal' : 'Failed to create meal',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  };

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
        <h2 className="text-2xl font-heading font-bold text-foreground">Meals</h2>
        <p className="text-muted-foreground">
          Create and manage your meals with their ingredients
        </p>
      </motion.div>

      {/* Add Meal Button */}
      <Button onClick={handleCreateMeal} className="w-full gap-2">
        <Plus className="w-4 h-4" />
        Add Meal
      </Button>

      {/* Meals List */}
      <div className="space-y-3">
        {meals.map((meal) => (
          <motion.div
            key={meal.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <UtensilsCrossed className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold">{meal.name}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      {meal.product_count} product{meal.product_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 active:scale-95"
                    onClick={() => handleEditMeal(meal.id)}
                    aria-label="Edit meal"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 active:scale-95 active:bg-red-100"
                    onClick={() => handleDeleteMeal(meal.id, meal.name)}
                    aria-label="Delete meal"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}

        {meals.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <UtensilsCrossed className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No meals yet. Add one to get started.</p>
          </div>
        )}
      </div>

      {/* Meal Dialog */}
      <MealDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        meal={editingMeal}
        products={products}
        categories={categories}
        onSave={handleSaveMeal}
        onProductCreated={handleProductCreated}
      />
    </div>
  );
}
