const { GoogleGenerativeAI } = require('@google/generative-ai');
const Category = require('../models/Category');

class AIService {
    constructor() {
        this.genAI = null;
        this.model = null;
        this.cachedCategories = null;
        this.cacheExpiry = null;
        
        // Request tracking for rate limiting visibility
        this.requestHistory = [];
        this.totalRequests = 0;
        this.totalTokensUsed = 0;
    }

    initialize() {
        if (!process.env.GOOGLE_API_KEY) {
            console.warn('⚠️ GOOGLE_API_KEY not set - AI parsing will not work');
            return;
        }
        this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        console.log('✅ AI Service initialized');
    }

    // Track a request
    trackRequest(inputTokens = 0, outputTokens = 0, success = true) {
        const now = Date.now();
        this.requestHistory.push({
            timestamp: now,
            inputTokens,
            outputTokens,
            success
        });
        this.totalRequests++;
        this.totalTokensUsed += inputTokens + outputTokens;
        
        // Keep only last hour of history
        const oneHourAgo = now - 60 * 60 * 1000;
        this.requestHistory = this.requestHistory.filter(r => r.timestamp > oneHourAgo);
    }

    // Get stats for display
    getStats() {
        const now = Date.now();
        const oneMinuteAgo = now - 60 * 1000;
        const oneHourAgo = now - 60 * 60 * 1000;
        
        const lastMinute = this.requestHistory.filter(r => r.timestamp > oneMinuteAgo);
        const lastHour = this.requestHistory.filter(r => r.timestamp > oneHourAgo);
        
        const lastMinuteTokens = lastMinute.reduce((sum, r) => sum + r.inputTokens + r.outputTokens, 0);
        const lastHourTokens = lastHour.reduce((sum, r) => sum + r.inputTokens + r.outputTokens, 0);
        
        const successfulLastHour = lastHour.filter(r => r.success).length;
        const failedLastHour = lastHour.filter(r => !r.success).length;
        
        return {
            isInitialized: !!this.model,
            // model: 'gemini-2.5-flash',
            model: 'gemini-2.5-flash-lite',
            
            // Request counts
            requestsLastMinute: lastMinute.length,
            requestsLastHour: lastHour.length,
            totalRequestsAllTime: this.totalRequests,
            
            // Token usage
            tokensLastMinute: lastMinuteTokens,
            tokensLastHour: lastHourTokens,
            totalTokensAllTime: this.totalTokensUsed,
            
            // Success/failure
            successfulLastHour,
            failedLastHour,
            
            // Gemini 2.5 Flash rate limits (for reference)
            rateLimits: {
                requestsPerMinute: 15,        // Free tier RPM
                requestsPerDay: 1500,         // Free tier RPD
                tokensPerMinute: 1000000,     // Free tier TPM
            },
            
            // Usage percentages
            usagePercent: {
                rpm: Math.round((lastMinute.length / 15) * 100),
                tpm: Math.round((lastMinuteTokens / 1000000) * 100),
            }
        };
    }

    // Fetch categories from database (with caching)
    async getCategoryNames() {
        const now = Date.now();
        // Cache for 5 minutes
        if (this.cachedCategories && this.cacheExpiry && now < this.cacheExpiry) {
            return this.cachedCategories;
        }

        try {
            const categories = await Category.findAll();
            this.cachedCategories = categories.map(c => c.name);
            this.cacheExpiry = now + 5 * 60 * 1000; // 5 minutes
            return this.cachedCategories;
        } catch (error) {
            console.error('Failed to fetch categories for AI:', error);
            // Fallback to cached or default
            return this.cachedCategories || ['Autre'];
        }
    }

    // Clear category cache (call when categories are modified)
    clearCategoryCache() {
        this.cachedCategories = null;
        this.cacheExpiry = null;
    }

    async parseGroceryItems(groceryText) {
        if (!this.model) {
            throw new Error('AI Service not initialized');
        }

        const startTime = Date.now();
        let inputTokens = 0;
        let outputTokens = 0;

        try {
            console.log('🔍 AI Input Text:', JSON.stringify(groceryText));
            const prompt = await this.buildGroceryParsingPrompt(groceryText);
            
            // Estimate input tokens (rough: ~4 chars per token)
            inputTokens = Math.ceil(prompt.length / 4);
            
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            // Estimate output tokens
            outputTokens = Math.ceil(text.length / 4);
            
            console.log('🤖 AI Raw Response:', text);
            console.log(`📊 Estimated tokens - Input: ${inputTokens}, Output: ${outputTokens}`);

            // Track successful request
            this.trackRequest(inputTokens, outputTokens, true);

            // Try to parse the JSON response
            let parsedItems;
            try {
                // Clean the response by removing markdown code blocks
                const cleanedText = text.replace(/```json\n?|\n?```/g, '').trim();
                console.log('🧹 AI Cleaned Response:', cleanedText);
                parsedItems = JSON.parse(cleanedText);
            } catch (parseError) {
                console.error('Failed to parse AI response as JSON:', text);
                throw new Error('AI response was not valid JSON');
            }

            // Validate the response structure
            if (!Array.isArray(parsedItems)) {
                throw new Error('AI response was not an array');
            }

            // Validate each item has required fields
            const validatedItems = parsedItems.map(item => {
                if (!item.article || !item.category) {
                    throw new Error('AI response missing required fields');
                }
                
                return {
                    article: item.article.trim(),
                    quantity: parseInt(item.quantity) || 1,
                    category: item.category.trim()
                };
            });

            console.log(`✅ AI parsed ${validatedItems.length} items from grocery list`);
            return validatedItems;

        } catch (error) {
            // Track failed request
            this.trackRequest(inputTokens, outputTokens, false);
            console.error('Error parsing grocery items with AI:', error);
            throw new Error(`Failed to parse grocery items: ${error.message}`);
        }
    }

    async buildGroceryParsingPrompt(groceryText) {
        const categoryNames = await this.getCategoryNames();
        const categoriesList = categoryNames.join(', ');
        
        return `SYSTEM: You are a grocery list parser that corrects spelling and grammar errors in French grocery lists. Each LINE is ONE COMPLETE item name. NEVER split words within a line.

EXAMPLES OF CORRECT PARSING:
Input line: "Oeuf Dan" → ONE item: {"article": "Oeuf Dan", "quantity": 1, "category": "Produits laitiers"}
Input line: "Pain complet" → ONE item: {"article": "Pain complet", "quantity": 1, "category": "Boulangerie"}
Input line: "2 pommes" → ONE item: {"article": "pommes", "quantity": 2, "category": "Fruits et légumes"}
Input line: "Chocolat noir noisettes" → ONE item: {"article": "Chocolat noir noisettes", "quantity": 1, "category": "Épicerie"}

WRONG (DO NOT DO THIS):
Input line: "Oeuf Dan" → DO NOT create two items for "Oeuf" and "Dan"
Input line: "Pain complet" → DO NOT create two items for "Pain" and "complet"

Categories available: ${categoriesList}

RULES:
1. FIRST: Correct any spelling and grammar errors in the French text
2. Each line = exactly ONE item in output JSON
3. Keep complete item names together (all words on same line = one item name)
4. Extract quantity if mentioned (e.g., "2 pommes" → quantity: 2, article: "pommes")
5. If a word is in Hebrew, keep it in Hebrew and categorize it according to its meaning
6. If you don't understand a word, return it with "Unknown" category
7. Use "Unknown" if unsure about category
8. Do NOT add any items that are not in the input list
9. Return ONLY valid JSON array, no other text

Parse and correct this French grocery list (each line is one item):
${groceryText}`;
    }
}

// Create singleton instance
const aiService = new AIService();

module.exports = aiService;
