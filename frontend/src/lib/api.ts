const API_BASE = '/api';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async register(email: string, password: string, name: string) {
    return this.request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  async login(email: string, password: string) {
    return this.request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getMe() {
    return this.request<{ user: User }>('/auth/me');
  }

  // Password Reset
  async generateResetToken(email: string) {
    return this.request<{ message: string; resetUrl: string; expiresAt: string; userEmail: string }>('/auth/admin/reset-token', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, password: string) {
    return this.request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  // Categories
  async getCategories() {
    return this.request<Category[]>('/products/categories');
  }

  async createCategory(name: string, icon?: string, sortOrder?: number) {
    return this.request<Category>('/products/categories', {
      method: 'POST',
      body: JSON.stringify({ name, icon, sort_order: sortOrder }),
    });
  }

  async updateCategory(id: number, updates: Partial<Category>) {
    return this.request<Category>(`/products/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteCategory(id: number) {
    return this.request<{ message: string }>(`/products/categories/${id}`, {
      method: 'DELETE',
    });
  }

  // Products
  async getProducts(categoryId?: number, search?: string) {
    const params = new URLSearchParams();
    if (categoryId) params.append('category_id', categoryId.toString());
    if (search) params.append('search', search);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<Product[]>(`/products${query}`);
  }

  async getProduct(id: number) {
    return this.request<Product & { aliases: string[] }>(`/products/${id}`);
  }

  async createProduct(name: string, categoryId: number, aliases?: string[]) {
    return this.request<Product & { aliases: string[] }>('/products', {
      method: 'POST',
      body: JSON.stringify({ name, category_id: categoryId, aliases }),
    });
  }

  async updateProduct(id: number, updates: { name?: string; category_id?: number }) {
    return this.request<Product & { aliases: string[] }>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteProduct(id: number) {
    return this.request<{ message: string }>(`/products/${id}`, {
      method: 'DELETE',
    });
  }

  async addProductAlias(productId: number, alias: string) {
    return this.request<{ aliases: string[] }>(`/products/${productId}/aliases`, {
      method: 'POST',
      body: JSON.stringify({ alias }),
    });
  }

  async removeProductAlias(productId: number, alias: string) {
    return this.request<{ aliases: string[] }>(`/products/${productId}/aliases/${encodeURIComponent(alias)}`, {
      method: 'DELETE',
    });
  }

  async fixProductSpelling(productId: number) {
    return this.request<Product & { aliases: string[]; corrected: boolean; originalName: string | null }>(
      `/products/${productId}/fix-spelling`,
      { method: 'POST' }
    );
  }

  async getSpellSuggestions(text: string) {
    return this.request<SpellSuggestResponse>(
      `/products/spell-suggest?text=${encodeURIComponent(text)}`
    );
  }

  // Groceries
  async getGroceries() {
    return this.request<GroceryListResponse>('/groceries');
  }

  async parseAndAddItems(text: string) {
    return this.request<ParseResult>('/groceries/parse', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  async addItem(productId: number, quantity?: number, note?: string) {
    return this.request<GroceryItem>('/groceries', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, quantity, note }),
    });
  }

  async updateItem(id: number, updates: { product_id?: number; quantity?: number; note?: string; status?: ItemStatus }) {
    return this.request<GroceryItem>(`/groceries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async updateItemStatus(id: number, status: ItemStatus) {
    return this.request<GroceryItem>(`/groceries/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async deleteItem(id: number) {
    return this.request<{ message: string }>(`/groceries/${id}`, {
      method: 'DELETE',
    });
  }

  async deleteBatch(batchId: string) {
    return this.request<{ message: string }>(`/groceries/batch/${batchId}`, {
      method: 'DELETE',
    });
  }

  async completeShopping() {
    return this.request<ShoppingResult>('/groceries/complete-shopping', {
      method: 'POST',
    });
  }

  async clearFoundItems() {
    return this.request<{ message: string }>('/groceries/status/found', {
      method: 'DELETE',
    });
  }

  async resetSelection() {
    return this.request<{ message: string }>('/groceries/reset-selection', {
      method: 'POST',
    });
  }

  // History
  async getHistory(limit?: number, status?: string) {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (status) params.append('status', status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<HistoryItem[]>(`/history${query}`);
  }

  async getSessions(limit?: number) {
    const query = limit ? `?limit=${limit}` : '';
    return this.request<ShoppingSession[]>(`/history/sessions${query}`);
  }

  async getSessionItems(sessionId: string) {
    return this.request<HistoryItem[]>(`/history/sessions/${sessionId}`);
  }

  async restoreItem(historyId: number) {
    return this.request<GroceryItem>(`/history/${historyId}/restore`, {
      method: 'POST',
    });
  }

  // Admin
  async getAIStats() {
    return this.request<AIStats>('/groceries/ai-stats');
  }

  // Meals
  async getMeals() {
    return this.request<Meal[]>('/meals');
  }

  async getMeal(id: number) {
    return this.request<MealWithProducts>(`/meals/${id}`);
  }

  async createMeal(name: string, productIds: number[]) {
    return this.request<MealWithProducts>('/meals', {
      method: 'POST',
      body: JSON.stringify({ name, product_ids: productIds }),
    });
  }

  async updateMeal(id: number, name: string, productIds: number[]) {
    return this.request<MealWithProducts>(`/meals/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, product_ids: productIds }),
    });
  }

  async deleteMeal(id: number) {
    return this.request<{ message: string }>(`/meals/${id}`, {
      method: 'DELETE',
    });
  }

  // Menu Planning
  async getMenuPlan(weekStart?: string) {
    const query = weekStart ? `?week_start=${weekStart}` : '';
    return this.request<MenuPlanResponse>(`/menu${query}`);
  }

  async getMenuProducts(weekStart?: string) {
    const query = weekStart ? `?week_start=${weekStart}` : '';
    return this.request<MenuProduct[]>(`/menu/products${query}`);
  }

  async getMealProducts(mealId: number) {
    return this.request<MenuProduct[]>(`/menu/meal/${mealId}/products`);
  }

  async addMealToDay(weekStart: string, dayOfWeek: number, mealType: 'lunch' | 'dinner', mealId: number) {
    return this.request<MenuPlanResponse>('/menu/day', {
      method: 'POST',
      body: JSON.stringify({ week_start: weekStart, day_of_week: dayOfWeek, meal_type: mealType, meal_id: mealId }),
    });
  }

  async removeMealFromDay(planItemId: number) {
    return this.request<{ message: string }>(`/menu/item/${planItemId}`, {
      method: 'DELETE',
    });
  }

  async addProductsToGroceries(productIds: number[]) {
    return this.request<{ message: string; addedCount: number; skippedCount: number; batchId: string }>('/menu/add-to-groceries', {
      method: 'POST',
      body: JSON.stringify({ product_ids: productIds }),
    });
  }
}

// Types
export interface User {
  id: number;
  email: string;
  name: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  icon: string;
  sort_order: number;
}

export interface Product {
  id: number;
  name: string;
  category_id: number;
  category_name: string;
  category_icon: string;
  created_at: string;
  updated_at: string;
  aliases?: string[];
}

export type ItemStatus = 'pending' | 'selected' | 'found' | 'not_found';

export interface GroceryItem {
  id: number;
  user_id: number;
  product_id: number;
  product_name: string;
  category_id: number;
  category_name: string;
  category_icon: string;
  quantity: number;
  status: ItemStatus;
  batch_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroceryListResponse {
  allItems: GroceryItem[];
  activeItems: GroceryItem[];
  foundItems: GroceryItem[];
  grouped: Record<string, GroceryItem[]>;
  categoryInfo: Record<string, { icon: string }>;
}

export interface ParseResult {
  batchId: string;
  items: GroceryItem[];
  stats: {
    total: number;
    fromCache: number;
    fromAI: number;
  };
}

export interface ShoppingResult {
  sessionId: string;
  archivedCount: number;
  foundCount: number;
  notFoundCount: number;
}

export interface HistoryItem {
  id: number;
  user_id: number;
  product_id: number | null;
  product_name: string;
  category_name: string;
  quantity: number;
  status: string;
  completed_at: string;
  shopping_session_id: string;
}

export interface ShoppingSession {
  shopping_session_id: string;
  started_at: string;
  ended_at: string;
  item_count: number;
  found_count: number;
  not_found_count: number;
}

export interface AIStats {
  isInitialized: boolean;
  model: string;
  requestsLastMinute: number;
  requestsLastHour: number;
  totalRequestsAllTime: number;
  tokensLastMinute: number;
  tokensLastHour: number;
  totalTokensAllTime: number;
  successfulLastHour: number;
  failedLastHour: number;
  rateLimits: {
    requestsPerMinute: number;
    requestsPerDay: number;
    tokensPerMinute: number;
  };
  usagePercent: {
    rpm: number;
    tpm: number;
  };
}

export interface Meal {
  id: number;
  user_id: number;
  name: string;
  product_count: number;
  created_at: string;
  updated_at: string;
}

export interface MealProduct {
  id: number;
  name: string;
  category_name: string;
  category_icon: string;
}

export interface MealWithProducts extends Meal {
  products: MealProduct[];
}

export interface MenuPlanItem {
  id: number;
  meal_id: number;
  meal_name: string;
  meal_type: 'lunch' | 'dinner';
  product_count: number;
}

export interface DayPlan {
  lunch: MenuPlanItem[];
  dinner: MenuPlanItem[];
}

export interface MenuPlanResponse {
  weekStart: string;
  plan: Record<number, DayPlan>;
}

export interface MenuProduct {
  id: number;
  name: string;
  category_name: string;
  category_icon: string;
  sort_order?: number;
}

export interface SpellWordSuggestion {
  word: string;
  language: string;
  suggestions: string[];
}

export interface SpellSuggestResponse {
  available: boolean;
  message?: string;
  words: SpellWordSuggestion[];
  combinedSuggestions: string[];
}

export const api = new ApiClient();
