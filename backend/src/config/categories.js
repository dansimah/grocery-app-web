// Default categories for INITIAL database seeding only
// Once seeded, categories are managed via the database and UI
// The AI service fetches categories directly from the database
const DEFAULT_CATEGORIES = [
    { name: 'Fruits et légumes', icon: '🥬', sort_order: 1 },
    { name: 'Boulangerie', icon: '🥖', sort_order: 2 },
    { name: 'Produits laitiers', icon: '🥛', sort_order: 3 },
    { name: 'Viandes et Poulet', icon: '🥩', sort_order: 4 },
    { name: 'Épicerie', icon: '🛒', sort_order: 5 },
    { name: 'Surgelés', icon: '🧊', sort_order: 6 },
    { name: 'Boissons', icon: '🥤', sort_order: 7 },
    { name: 'Conserves', icon: '🥫', sort_order: 8 },
    { name: 'Hygiène', icon: '🧴', sort_order: 9 },
    { name: 'Vaiselle Jetable', icon: '🍽️', sort_order: 10 },
    { name: 'Autre', icon: '📦', sort_order: 99 },
];

module.exports = {
    DEFAULT_CATEGORIES,
    // Alias for backward compatibility with seed.js
    CATEGORIES: DEFAULT_CATEGORIES,
};

