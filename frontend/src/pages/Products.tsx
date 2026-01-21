import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Search, Edit2, Trash2, Tag, ChevronDown, ChevronRight, Plus, GripVertical } from 'lucide-react';
import { api, Product, Category } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import EditProductDialog from '@/components/EditProductDialog';

type Tab = 'products' | 'categories';

export default function Products() {
  const [activeTab, setActiveTab] = useState<Tab>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editProductId, setEditProductId] = useState<number | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  // Category editing state
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [isCategoryEditOpen, setIsCategoryEditOpen] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('📦');
  const [newCategorySortOrder, setNewCategorySortOrder] = useState('50');

  // Add Product state
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategoryId, setNewProductCategoryId] = useState<string>('');
  
  const { toast } = useToast();

  useEffect(() => {
    loadData(true);
  }, []);

  const loadData = async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const [productsData, categoriesData] = await Promise.all([
        api.getProducts(),
        api.getCategories(),
      ]);
      setProducts(productsData);
      setCategories(categoriesData);
      // Only set expanded categories on initial load
      if (showLoading) {
        setExpandedCategories(new Set(categoriesData.map(c => c.name)));
      }
    } catch (error) {
      toast({
        title: 'Failed to load data',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadData();
      return;
    }
    try {
      const results = await api.getProducts(undefined, searchQuery);
      setProducts(results);
    } catch (error) {
      toast({ title: 'Search failed', variant: 'destructive' });
    }
  };

  // Product handlers
  const openEditProduct = (product: Product) => {
    setEditProductId(product.id);
    setIsEditOpen(true);
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Delete this product? This will also remove it from any grocery lists.')) return;
    try {
      await api.deleteProduct(id);
      toast({ title: 'Product deleted' });
      loadData();
    } catch (error) {
      toast({ title: 'Failed to delete', variant: 'destructive' });
    }
  };

  const handleAddProduct = async () => {
    if (!newProductName.trim() || !newProductCategoryId) return;
    try {
      await api.createProduct(newProductName.trim(), parseInt(newProductCategoryId));
      toast({ title: 'Product created' });
      setIsAddProductOpen(false);
      setNewProductName('');
      setNewProductCategoryId('');
      loadData();
    } catch (error) {
      toast({
        title: 'Failed to create product',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  };

  // Category handlers
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await api.createCategory(
        newCategoryName.trim(),
        newCategoryIcon || '📦',
        parseInt(newCategorySortOrder) || 50
      );
      toast({ title: 'Category created' });
      setIsAddCategoryOpen(false);
      setNewCategoryName('');
      setNewCategoryIcon('📦');
      setNewCategorySortOrder('50');
      loadData();
    } catch (error) {
      toast({
        title: 'Failed to create category',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateCategory = async () => {
    if (!editCategory) return;
    try {
      await api.updateCategory(editCategory.id, {
        name: editCategory.name,
        icon: editCategory.icon,
        sort_order: editCategory.sort_order,
      });
      toast({ title: 'Category updated' });
      setIsCategoryEditOpen(false);
      loadData();
    } catch (error) {
      toast({
        title: 'Failed to update',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteCategory = async (id: number, name: string, productCount: number) => {
    if (productCount > 0) {
      toast({
        title: 'Cannot delete',
        description: `This category has ${productCount} products. Move them first.`,
        variant: 'destructive',
      });
      return;
    }
    if (!confirm(`Delete category "${name}"?`)) return;
    try {
      await api.deleteCategory(id);
      toast({ title: 'Category deleted' });
      loadData();
    } catch (error) {
      toast({
        title: 'Failed to delete',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  };

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  };

  // Filter and group products
  const filteredProducts = searchQuery
    ? products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : products;

  const groupedProducts: Record<string, Product[]> = {};
  for (const product of filteredProducts) {
    const cat = product.category_name || 'Autre';
    if (!groupedProducts[cat]) {
      groupedProducts[cat] = [];
    }
    groupedProducts[cat].push(product);
  }

  // Get product count per category
  const getCategoryProductCount = (categoryName: string) => {
    return products.filter(p => p.category_name === categoryName).length;
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
        <h2 className="text-2xl font-heading font-bold text-foreground">Product Management</h2>
        <p className="text-muted-foreground">
          Manage products and categories
        </p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg">
        <Button
          variant={activeTab === 'products' ? 'default' : 'ghost'}
          className="flex-1 gap-2"
          onClick={() => setActiveTab('products')}
        >
          <Package className="w-4 h-4" />
          Products ({products.length})
        </Button>
        <Button
          variant={activeTab === 'categories' ? 'default' : 'ghost'}
          className="flex-1 gap-2"
          onClick={() => setActiveTab('categories')}
        >
          <Tag className="w-4 h-4" />
          Categories ({categories.length})
        </Button>
      </div>

      {/* Products Tab */}
      {activeTab === 'products' && (
        <>
          {/* Add Product Button */}
          <Button onClick={() => setIsAddProductOpen(true)} className="w-full gap-2">
            <Plus className="w-4 h-4" />
            Add Product
          </Button>

          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} variant="secondary">
              Search
            </Button>
          </div>

          {/* Products by Category */}
          <div className="space-y-4">
            {Object.entries(groupedProducts).map(([category, categoryProducts]) => {
              const categoryData = categories.find(c => c.name === category);
              const isExpanded = expandedCategories.has(category);
              
              return (
                <Card key={category} className="overflow-hidden">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xl">
                        {categoryData?.icon || '📦'}
                      </span>
                      <div className="text-left">
                        <h3 className="font-heading font-semibold">{category}</h3>
                        <p className="text-xs text-muted-foreground">
                          {categoryProducts.length} product{categoryProducts.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                  
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <CardContent className="pt-0 pb-3 px-3">
                          <div className="space-y-1">
                            {categoryProducts.map((product) => (
                              <div
                                key={product.id}
                                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 active:bg-muted group"
                              >
                                <span className="font-medium">{product.name}</span>
                                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 active:scale-95"
                                    onClick={() => openEditProduct(product)}
                                    aria-label="Edit product"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 active:scale-95 active:bg-red-100"
                                    onClick={() => handleDeleteProduct(product.id)}
                                    aria-label="Delete product"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <>
          {/* Add Category Button */}
          <Button onClick={() => setIsAddCategoryOpen(true)} className="w-full gap-2">
            <Plus className="w-4 h-4" />
            Add Category
          </Button>

          {/* Categories List */}
          <div className="space-y-2">
            {categories
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((category) => {
                const productCount = getCategoryProductCount(category.name);
                return (
                  <Card key={category.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <GripVertical className="w-4 h-4" />
                          <span className="text-xs w-6 text-center">{category.sort_order}</span>
                        </div>
                        <span className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xl">
                          {category.icon}
                        </span>
                        <div>
                          <h3 className="font-heading font-semibold">{category.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {productCount} product{productCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 active:scale-95"
                          onClick={() => {
                            setEditCategory(category);
                            setIsCategoryEditOpen(true);
                          }}
                          aria-label="Edit category"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 active:scale-95 active:bg-red-100"
                          onClick={() => handleDeleteCategory(category.id, category.name, productCount)}
                          aria-label="Delete category"
                          disabled={productCount > 0}
                        >
                          <Trash2 className={`w-4 h-4 ${productCount > 0 ? 'text-gray-300' : 'text-red-500'}`} />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
          </div>

          {categories.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Tag className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No categories yet. Add one to get started.</p>
            </div>
          )}
        </>
      )}

      {/* Edit Product Dialog */}
      <EditProductDialog
        productId={editProductId}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSaved={loadData}
      />

      {/* Add Category Dialog */}
      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                placeholder="e.g., Fruits et légumes"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cat-icon">Icon (emoji)</Label>
                <Input
                  id="cat-icon"
                  placeholder="📦"
                  value={newCategoryIcon}
                  onChange={(e) => setNewCategoryIcon(e.target.value)}
                  className="text-center text-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-order">Sort Order</Label>
                <Input
                  id="cat-order"
                  type="number"
                  placeholder="50"
                  value={newCategorySortOrder}
                  onChange={(e) => setNewCategorySortOrder(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Lower sort order = appears first in the list
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddCategoryOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCategory} disabled={!newCategoryName.trim()}>
              Add Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={isCategoryEditOpen} onOpenChange={setIsCategoryEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          {editCategory && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-cat-name">Name</Label>
                <Input
                  id="edit-cat-name"
                  value={editCategory.name}
                  onChange={(e) => setEditCategory({ ...editCategory, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-cat-icon">Icon (emoji)</Label>
                  <Input
                    id="edit-cat-icon"
                    value={editCategory.icon}
                    onChange={(e) => setEditCategory({ ...editCategory, icon: e.target.value })}
                    className="text-center text-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-cat-order">Sort Order</Label>
                  <Input
                    id="edit-cat-order"
                    type="number"
                    value={editCategory.sort_order}
                    onChange={(e) => setEditCategory({ ...editCategory, sort_order: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoryEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateCategory}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Product Dialog */}
      <Dialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="product-name">Name</Label>
              <Input
                id="product-name"
                placeholder="e.g., Milk"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-category">Category</Label>
              <select
                id="product-category"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={newProductCategoryId}
                onChange={(e) => setNewProductCategoryId(e.target.value)}
              >
                <option value="">Select a category...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddProductOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddProduct} 
              disabled={!newProductName.trim() || !newProductCategoryId}
            >
              Add Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
