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

export const api = new ApiClient();
