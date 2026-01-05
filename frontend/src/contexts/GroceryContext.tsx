import React, { createContext, useContext, useState, useCallback } from 'react';
import { api, GroceryItem, GroceryListResponse, ItemStatus, Category } from '@/lib/api';

interface GroceryContextType {
  items: GroceryItem[];
  activeItems: GroceryItem[];
  foundItems: GroceryItem[];
  grouped: Record<string, GroceryItem[]>;
  categoryInfo: Record<string, { icon: string }>;
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  fetchItems: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  parseAndAdd: (text: string) => Promise<{ total: number; fromCache: number; fromAI: number }>;
  addItem: (productId: number, quantity?: number, note?: string) => Promise<void>;
  updateItem: (id: number, updates: { product_id?: number; quantity?: number; note?: string; status?: ItemStatus }) => Promise<void>;
  updateStatus: (id: number, status: ItemStatus) => Promise<void>;
  deleteItem: (id: number) => Promise<void>;
  completeShopping: () => Promise<{ foundCount: number; notFoundCount: number }>;
  clearFound: () => Promise<void>;
}

const GroceryContext = createContext<GroceryContextType | undefined>(undefined);

export function GroceryProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<GroceryListResponse>({
    allItems: [],
    activeItems: [],
    foundItems: [],
    grouped: {},
    categoryInfo: {},
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.getGroceries();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch items');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const result = await api.getCategories();
      setCategories(result);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  }, []);

  const parseAndAdd = useCallback(async (text: string) => {
    const result = await api.parseAndAddItems(text);
    await fetchItems();
    return result.stats;
  }, [fetchItems]);

  const addItem = useCallback(async (productId: number, quantity?: number, note?: string) => {
    await api.addItem(productId, quantity, note);
    await fetchItems();
  }, [fetchItems]);

  const updateItem = useCallback(async (id: number, updates: { product_id?: number; quantity?: number; note?: string; status?: ItemStatus }) => {
    await api.updateItem(id, updates);
    await fetchItems();
  }, [fetchItems]);

  const updateStatus = useCallback(async (id: number, status: ItemStatus) => {
    await api.updateItemStatus(id, status);
    // Optimistic update - properly move items between lists
    setData(prev => {
      const updatedAllItems = prev.allItems.map(item => 
        item.id === id ? { ...item, status } : item
      );
      
      // Find the updated item
      const updatedItem = updatedAllItems.find(item => item.id === id);
      
      // Rebuild activeItems and foundItems based on new status
      const newActiveItems = updatedAllItems.filter(item => 
        item.status === 'pending' || item.status === 'selected' || item.status === 'not_found'
      );
      const newFoundItems = updatedAllItems.filter(item => item.status === 'found');
      
      // Rebuild grouped (for active items only, excluding found)
      const pendingAndSelected = updatedAllItems.filter(item => 
        item.status === 'pending' || item.status === 'selected'
      );
      const newGrouped = pendingAndSelected.reduce((acc, item) => {
        const cat = item.category_name;
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
      }, {} as Record<string, GroceryItem[]>);
      
      return {
        ...prev,
        allItems: updatedAllItems,
        activeItems: newActiveItems,
        foundItems: newFoundItems,
        grouped: newGrouped,
      };
    });
  }, []);

  const deleteItem = useCallback(async (id: number) => {
    await api.deleteItem(id);
    await fetchItems();
  }, [fetchItems]);

  const completeShopping = useCallback(async () => {
    const result = await api.completeShopping();
    await fetchItems();
    return {
      foundCount: result.foundCount,
      notFoundCount: result.notFoundCount,
    };
  }, [fetchItems]);

  const clearFound = useCallback(async () => {
    await api.clearFoundItems();
    await fetchItems();
  }, [fetchItems]);

  return (
    <GroceryContext.Provider
      value={{
        items: data.allItems,
        activeItems: data.activeItems,
        foundItems: data.foundItems,
        grouped: data.grouped,
        categoryInfo: data.categoryInfo,
        categories,
        isLoading,
        error,
        fetchItems,
        fetchCategories,
        parseAndAdd,
        addItem,
        updateItem,
        updateStatus,
        deleteItem,
        completeShopping,
        clearFound,
      }}
    >
      {children}
    </GroceryContext.Provider>
  );
}

export function useGrocery() {
  const context = useContext(GroceryContext);
  if (context === undefined) {
    throw new Error('useGrocery must be used within a GroceryProvider');
  }
  return context;
}
