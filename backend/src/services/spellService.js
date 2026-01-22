const nspell = require('nspell');
const path = require('path');

class SpellService {
    constructor() {
        this.spellers = {};       // nspell spellers for fr/en
        this.hebrewSpeller = null; // cspell-lib speller for Hebrew
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // Load nspell dictionaries for French and English
            const [frDict, enDict] = await Promise.all([
                this.loadNspellDictionary('dictionary-fr'),
                this.loadNspellDictionary('dictionary-en'),
            ]);

            if (frDict) {
                this.spellers.fr = nspell(frDict);
                console.log('✅ French spell checker loaded (nspell)');
            }
            if (enDict) {
                this.spellers.en = nspell(enDict);
                console.log('✅ English spell checker loaded (nspell)');
            }

            // Load Hebrew dictionary via cspell-lib
            await this.loadHebrewDictionary();

            this.initialized = true;
            console.log('✅ Spell Service initialized');
        } catch (error) {
            console.error('❌ Failed to initialize spell service:', error.message);
        }
    }

    async loadHebrewDictionary() {
        try {
            const fs = require('fs');
            const zlib = require('zlib');
            const { importTrie, Trie } = await import('cspell-trie-lib');
            
            // Get the path to the Hebrew trie file
            const dictHePath = require.resolve('@cspell/dict-he/cspell-ext.json');
            const dictDir = path.dirname(dictHePath);
            const triePath = path.join(dictDir, 'he.trie.gz');
            
            // Read and decompress the trie file
            const compressed = fs.readFileSync(triePath);
            const decompressed = zlib.gunzipSync(compressed);
            const trieContent = decompressed.toString('utf-8');
            
            // Import the trie root and wrap in Trie class for .has() method
            const trieRoot = importTrie(trieContent.split('\n'));
            const trie = new Trie(trieRoot);
            this.hebrewSpeller = trie;
            
            console.log('✅ Hebrew spell checker loaded (cspell-trie)');
        } catch (error) {
            console.warn('⚠️ Hebrew spell checker not available:', error.message);
            this.hebrewSpeller = null;
        }
    }

    async loadNspellDictionary(dictName) {
        try {
            // Use dynamic import for ESM dictionary packages
            const dictModule = await import(dictName);
            const dict = dictModule.default || dictModule;
            
            // Handle both callback-style and promise-style dictionaries
            if (typeof dict === 'function') {
                // Add timeout to prevent hanging if callback never fires
                return new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        console.warn(`⚠️ Dictionary ${dictName} timed out after 5s`);
                        resolve(null);
                    }, 5000);
                    
                    dict((err, result) => {
                        clearTimeout(timeout);
                        if (err) {
                            console.warn(`⚠️ Failed to load ${dictName}:`, err.message);
                            resolve(null);
                        } else {
                            resolve(result);
                        }
                    });
                });
            } else if (dict && dict.aff && dict.dic) {
                // Already resolved dictionary object
                return dict;
            } else {
                console.warn(`⚠️ Unknown dictionary format for ${dictName}`);
                return null;
            }
        } catch (error) {
            console.warn(`⚠️ Dictionary ${dictName} not available:`, error.message);
            return null;
        }
    }

    // Detect language based on characters
    detectLanguage(word) {
        // Hebrew characters range: \u0590-\u05FF
        const hebrewPattern = /[\u0590-\u05FF]/;
        if (hebrewPattern.test(word)) {
            return 'he';
        }

        // Check for French-specific characters (accents)
        const frenchPattern = /[àâäéèêëïîôùûüÿçœæ]/i;
        if (frenchPattern.test(word)) {
            return 'fr';
        }

        // Default to French for this app (primary language)
        return 'fr';
    }

    // Get spell suggestions for a word
    getSuggestions(word, maxSuggestions = 5) {
        if (!word || word.length < 2) {
            return { language: null, correct: true, suggestions: [] };
        }

        const language = this.detectLanguage(word);
        
        // Handle Hebrew with cspell dictionary
        if (language === 'he') {
            return this.getHebrewSuggestions(word, maxSuggestions);
        }

        // Handle French/English with nspell
        const speller = this.spellers[language];

        if (!speller) {
            // Try English as fallback
            const fallbackSpeller = this.spellers.en;
            if (fallbackSpeller) {
                const correct = fallbackSpeller.correct(word);
                const suggestions = correct ? [] : fallbackSpeller.suggest(word).slice(0, maxSuggestions);
                return { language: 'en', correct, suggestions };
            }
            return { language: null, correct: true, suggestions: [] };
        }

        const correct = speller.correct(word);
        const suggestions = correct ? [] : speller.suggest(word).slice(0, maxSuggestions);

        return {
            language,
            correct,
            suggestions
        };
    }

    // Hebrew spell checking using cspell trie
    getHebrewSuggestions(word, maxSuggestions = 5) {
        if (!this.hebrewSpeller) {
            return { language: 'he', correct: true, suggestions: [] };
        }

        try {
            // Trie has .has() method for checking word existence
            const correct = this.hebrewSpeller.has(word);

            if (correct) {
                return { language: 'he', correct: true, suggestions: [] };
            }

            // Trie has .suggest() method for suggestions
            let suggestions = [];
            if (this.hebrewSpeller.suggest) {
                const result = this.hebrewSpeller.suggest(word, { numSuggestions: maxSuggestions });
                suggestions = result.map(s => typeof s === 'string' ? s : s.word).slice(0, maxSuggestions);
            }

            return {
                language: 'he',
                correct: false,
                suggestions
            };
        } catch (error) {
            console.warn('Hebrew spell check error:', error.message);
            return { language: 'he', correct: true, suggestions: [] };
        }
    }

    // Check a full product name (may have multiple words)
    checkProductName(productName) {
        if (!productName || !this.initialized) {
            return { words: [], suggestions: [] };
        }

        // Split into words, keeping track of positions
        const words = productName.split(/\s+/).filter(w => w.length > 1);
        const results = [];

        for (const word of words) {
            // Skip numbers and very short words
            if (/^\d+$/.test(word) || word.length < 2) {
                continue;
            }

            const check = this.getSuggestions(word);
            if (!check.correct && check.suggestions.length > 0) {
                results.push({
                    word,
                    language: check.language,
                    suggestions: check.suggestions
                });
            }
        }

        // Also provide a combined suggestion if there's only one misspelled word
        let combinedSuggestions = [];
        if (results.length === 1) {
            const misspelled = results[0];
            combinedSuggestions = misspelled.suggestions.map(suggestion => 
                productName.replace(new RegExp(escapeRegExp(misspelled.word), 'i'), suggestion)
            );
        }

        return {
            words: results,
            combinedSuggestions
        };
    }

    isInitialized() {
        return this.initialized;
    }

    getStatus() {
        const languages = [...Object.keys(this.spellers)];
        if (this.hebrewSpeller) {
            languages.push('he');
        }
        return {
            initialized: this.initialized,
            languages
        };
    }
}

// Helper to escape regex special characters
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Create singleton instance
const spellService = new SpellService();

module.exports = spellService;
