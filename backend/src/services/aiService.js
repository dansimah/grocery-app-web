const { GoogleGenerativeAI } = require('@google/generative-ai');
const Category = require('../models/Category');
const AILog = require('../models/AILog');

class AIService {
    constructor() {
        this.genAI = null;
        this.model = null;
        this.cachedCategories = null;
        this.cacheExpiry = null;
        
        // Request tracking for rate limiting visibility (in-memory for real-time stats)
        this.requestHistory = [];
        this.totalRequests = 0;
        this.totalTokensUsed = 0;
        
        // Recent failure logs (in-memory cache for quick access)
        this.recentFailures = [];
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

    // Track a request (logs to both in-memory and database)
    async trackRequest({ inputTokens = 0, outputTokens = 0, success = true, inputText = null, errorMessage = null, errorType = null, responseTimeMs = null }) {
        const now = Date.now();
        
        // In-memory tracking for real-time stats
        this.requestHistory.push({
            timestamp: now,
            inputTokens,
            outputTokens,
            success
        });
        this.totalRequests++;
        this.totalTokensUsed += inputTokens + outputTokens;
        
        // Keep only last hour of history in memory
        const oneHourAgo = now - 60 * 60 * 1000;
        this.requestHistory = this.requestHistory.filter(r => r.timestamp > oneHourAgo);
        
        // Track failures in memory for quick access
        if (!success) {
            this.recentFailures.push({
                timestamp: now,
                errorMessage,
                errorType,
                inputText: inputText ? inputText.substring(0, 200) : null
            });
            // Keep only last 20 failures in memory
            if (this.recentFailures.length > 20) {
                this.recentFailures = this.recentFailures.slice(-20);
            }
        }
        
        // Log to database (async, don't await to avoid blocking)
        AILog.create({
            requestType: 'grocery_parse',
            inputText,
            success,
            errorMessage,
            errorType,
            inputTokens,
            outputTokens,
            responseTimeMs
        }).catch(err => console.error('Failed to log to DB:', err.message));
    }

    // Get stats for display (includes recent failures from memory)
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
            model: 'gemini-2.5-flash',
            
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
            
            // Recent failures (from memory for quick access)
            recentFailures: this.recentFailures.slice(-10).reverse().map(f => ({
                timestamp: new Date(f.timestamp).toISOString(),
                errorType: f.errorType,
                errorMessage: f.errorMessage,
                inputPreview: f.inputText
            })),
            
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

    // Get detailed stats from database (for admin/debugging)
    async getDetailedStats(hoursBack = 24) {
        try {
            const [dbStats, recentFailures] = await Promise.all([
                AILog.getStats(hoursBack),
                AILog.findFailures(10)
            ]);
            
            return {
                ...this.getStats(),
                database: {
                    period: `last ${hoursBack} hours`,
                    totalRequests: parseInt(dbStats.total_requests) || 0,
                    successful: parseInt(dbStats.successful) || 0,
                    failed: parseInt(dbStats.failed) || 0,
                    totalInputTokens: parseInt(dbStats.total_input_tokens) || 0,
                    totalOutputTokens: parseInt(dbStats.total_output_tokens) || 0,
                    avgResponseTimeMs: Math.round(parseFloat(dbStats.avg_response_time_ms) || 0)
                },
                recentFailuresFromDb: recentFailures.map(f => ({
                    id: f.id,
                    timestamp: f.created_at,
                    errorType: f.error_type,
                    errorMessage: f.error_message,
                    inputPreview: f.input_text ? f.input_text.substring(0, 200) : null,
                    responseTimeMs: f.response_time_ms
                }))
            };
        } catch (error) {
            console.error('Failed to get detailed stats from DB:', error.message);
            return {
                ...this.getStats(),
                database: { error: error.message }
            };
        }
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
        const startTime = Date.now();
        let inputTokens = 0;
        let outputTokens = 0;

        // Check initialization before proceeding
        if (!this.model) {
            const errorMsg = 'AI Service not initialized - GOOGLE_API_KEY may be missing';
            console.error('❌', errorMsg);
            this.trackRequest({
                inputTokens: 0,
                outputTokens: 0,
                success: false,
                inputText: groceryText,
                errorMessage: errorMsg,
                errorType: 'NOT_INITIALIZED',
                responseTimeMs: 0
            });
            throw new Error(errorMsg);
        }

        try {
            console.log('🔍 AI Input Text:', JSON.stringify(groceryText));
            const prompt = await this.buildGroceryParsingPrompt(groceryText);
            
            // Estimate input tokens (rough: ~4 chars per token)
            inputTokens = Math.ceil(prompt.length / 4);
            
            console.log('📤 Sending request to Gemini API...');
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            const responseTimeMs = Date.now() - startTime;
            
            // Estimate output tokens
            outputTokens = Math.ceil(text.length / 4);
            
            console.log('🤖 AI Raw Response:', text);
            console.log(`📊 Estimated tokens - Input: ${inputTokens}, Output: ${outputTokens}, Time: ${responseTimeMs}ms`);

            // Try to parse the JSON response
            let parsedItems;
            try {
                // Clean the response by removing markdown code blocks
                const cleanedText = text.replace(/```json\n?|\n?```/g, '').trim();
                console.log('🧹 AI Cleaned Response:', cleanedText);
                parsedItems = JSON.parse(cleanedText);
            } catch (parseError) {
                console.error('Failed to parse AI response as JSON:', text);
                this.trackRequest({
                    inputTokens,
                    outputTokens,
                    success: false,
                    inputText: groceryText,
                    errorMessage: `JSON parse failed: ${parseError.message}`,
                    errorType: 'JSON_PARSE_ERROR',
                    responseTimeMs
                });
                throw new Error('AI response was not valid JSON');
            }

            // Validate the response structure
            if (!Array.isArray(parsedItems)) {
                this.trackRequest({
                    inputTokens,
                    outputTokens,
                    success: false,
                    inputText: groceryText,
                    errorMessage: 'Response was not an array',
                    errorType: 'INVALID_RESPONSE_STRUCTURE',
                    responseTimeMs
                });
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

            // Track successful request
            this.trackRequest({
                inputTokens,
                outputTokens,
                success: true,
                inputText: groceryText,
                responseTimeMs
            });

            console.log(`✅ AI parsed ${validatedItems.length} items from grocery list in ${responseTimeMs}ms`);
            return validatedItems;

        } catch (error) {
            const responseTimeMs = Date.now() - startTime;
            
            // Determine error type for better debugging
            let errorType = 'UNKNOWN';
            if (error.message?.includes('API key')) {
                errorType = 'API_KEY_ERROR';
            } else if (error.message?.includes('quota') || error.message?.includes('rate')) {
                errorType = 'RATE_LIMIT';
            } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
                errorType = 'NETWORK_ERROR';
            } else if (error.message?.includes('timeout')) {
                errorType = 'TIMEOUT';
            } else if (error.message?.includes('JSON') || error.message?.includes('parse')) {
                errorType = 'PARSE_ERROR';
            }
            
            // Track failed request (if not already tracked above)
            if (errorType === 'UNKNOWN' || errorType === 'API_KEY_ERROR' || errorType === 'RATE_LIMIT' || errorType === 'NETWORK_ERROR' || errorType === 'TIMEOUT') {
                this.trackRequest({
                    inputTokens,
                    outputTokens,
                    success: false,
                    inputText: groceryText,
                    errorMessage: error.message,
                    errorType,
                    responseTimeMs
                });
            }
            
            console.error(`❌ Error parsing grocery items with AI (${errorType}):`, error.message);
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
