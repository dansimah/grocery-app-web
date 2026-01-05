require('dotenv').config();
const { pool } = require('./database');
const { CATEGORIES } = require('./categories');

// Use the single source of truth for categories
const categories = CATEGORIES;

// Products with their category and aliases (spelling variants)
const products = [
    // Fruits et légumes
    { name: 'Pommes', category: 'Fruits et légumes', aliases: ['pomme', 'pome', 'pomes', 'apple', 'apples'] },
    { name: 'Bananes', category: 'Fruits et légumes', aliases: ['banane', 'banana', 'bananas'] },
    { name: 'Oranges', category: 'Fruits et légumes', aliases: ['orange'] },
    { name: 'Citrons', category: 'Fruits et légumes', aliases: ['citron', 'lemon', 'lemons'] },
    { name: 'Fraises', category: 'Fruits et légumes', aliases: ['fraise', 'strawberry', 'strawberries'] },
    { name: 'Raisins', category: 'Fruits et légumes', aliases: ['raisin', 'grape', 'grapes'] },
    { name: 'Poires', category: 'Fruits et légumes', aliases: ['poire', 'pear', 'pears'] },
    { name: 'Pêches', category: 'Fruits et légumes', aliases: ['pêche', 'peche', 'peach', 'peaches'] },
    { name: 'Cerises', category: 'Fruits et légumes', aliases: ['cerise', 'cherry', 'cherries'] },
    { name: 'Mangues', category: 'Fruits et légumes', aliases: ['mangue', 'mango'] },
    { name: 'Ananas', category: 'Fruits et légumes', aliases: ['pineapple'] },
    { name: 'Melon', category: 'Fruits et légumes', aliases: ['melons'] },
    { name: 'Pastèque', category: 'Fruits et légumes', aliases: ['pasteque', 'watermelon'] },
    { name: 'Kiwi', category: 'Fruits et légumes', aliases: ['kiwis'] },
    { name: 'Avocat', category: 'Fruits et légumes', aliases: ['avocats', 'avocado', 'avocados'] },
    { name: 'Tomates', category: 'Fruits et légumes', aliases: ['tomate', 'tomato', 'tomatoes'] },
    { name: 'Carottes', category: 'Fruits et légumes', aliases: ['carotte', 'carrot', 'carrots'] },
    { name: 'Pommes de terre', category: 'Fruits et légumes', aliases: ['pomme de terre', 'patates', 'patate', 'potato', 'potatoes'] },
    { name: 'Oignons', category: 'Fruits et légumes', aliases: ['oignon', 'onion', 'onions'] },
    { name: 'Ail', category: 'Fruits et légumes', aliases: ['garlic'] },
    { name: 'Poireaux', category: 'Fruits et légumes', aliases: ['poireau', 'leek', 'leeks'] },
    { name: 'Courgettes', category: 'Fruits et légumes', aliases: ['courgette', 'zucchini'] },
    { name: 'Aubergines', category: 'Fruits et légumes', aliases: ['aubergine', 'eggplant'] },
    { name: 'Poivrons', category: 'Fruits et légumes', aliases: ['poivron', 'pepper', 'peppers', 'bell pepper'] },
    { name: 'Concombre', category: 'Fruits et légumes', aliases: ['concombres', 'cucumber', 'cucumbers'] },
    { name: 'Salade', category: 'Fruits et légumes', aliases: ['salades', 'laitue', 'lettuce'] },
    { name: 'Épinards', category: 'Fruits et légumes', aliases: ['épinard', 'epinard', 'epinards', 'spinach'] },
    { name: 'Haricots verts', category: 'Fruits et légumes', aliases: ['haricot vert', 'green beans'] },
    { name: 'Brocoli', category: 'Fruits et légumes', aliases: ['brocolis', 'broccoli'] },
    { name: 'Chou-fleur', category: 'Fruits et légumes', aliases: ['chou fleur', 'choux-fleur', 'cauliflower'] },
    { name: 'Champignons', category: 'Fruits et légumes', aliases: ['champignon', 'mushroom', 'mushrooms'] },
    { name: 'Céleri', category: 'Fruits et légumes', aliases: ['celeri', 'celery'] },
    { name: 'Persil', category: 'Fruits et légumes', aliases: ['parsley'] },
    { name: 'Coriandre', category: 'Fruits et légumes', aliases: ['cilantro', 'coriander'] },
    { name: 'Basilic', category: 'Fruits et légumes', aliases: ['basil'] },
    { name: 'Menthe', category: 'Fruits et légumes', aliases: ['mint'] },

    // Boulangerie
    { name: 'Pain', category: 'Boulangerie', aliases: ['pains', 'bread'] },
    { name: 'Baguette', category: 'Boulangerie', aliases: ['baguettes'] },
    { name: 'Pain de mie', category: 'Boulangerie', aliases: ['pain de mi', 'toast bread'] },
    { name: 'Pain complet', category: 'Boulangerie', aliases: ['whole wheat bread'] },
    { name: 'Croissants', category: 'Boulangerie', aliases: ['croissant'] },
    { name: 'Pains au chocolat', category: 'Boulangerie', aliases: ['pain au chocolat', 'chocolatine', 'chocolatines'] },
    { name: 'Brioche', category: 'Boulangerie', aliases: ['brioches'] },
    { name: 'Pain aux raisins', category: 'Boulangerie', aliases: ['pains aux raisins'] },
    { name: 'Pain de campagne', category: 'Boulangerie', aliases: ['country bread'] },
    { name: 'Pain aux céréales', category: 'Boulangerie', aliases: ['pain cereales', 'multigrain bread'] },

    // Produits laitiers
    { name: 'Lait', category: 'Produits laitiers', aliases: ['milk'] },
    { name: 'Lait demi-écrémé', category: 'Produits laitiers', aliases: ['lait demi ecreme', 'semi-skimmed milk'] },
    { name: 'Lait entier', category: 'Produits laitiers', aliases: ['whole milk'] },
    { name: 'Beurre', category: 'Produits laitiers', aliases: ['butter'] },
    { name: 'Crème fraîche', category: 'Produits laitiers', aliases: ['creme fraiche', 'cream', 'crème'] },
    { name: 'Fromage', category: 'Produits laitiers', aliases: ['fromages', 'cheese'] },
    { name: 'Fromage râpé', category: 'Produits laitiers', aliases: ['fromage rape', 'grated cheese', 'emmental râpé'] },
    { name: 'Camembert', category: 'Produits laitiers', aliases: [] },
    { name: 'Brie', category: 'Produits laitiers', aliases: [] },
    { name: 'Comté', category: 'Produits laitiers', aliases: ['comte'] },
    { name: 'Gruyère', category: 'Produits laitiers', aliases: ['gruyere'] },
    { name: 'Mozzarella', category: 'Produits laitiers', aliases: ['mozza', 'mozzarela'] },
    { name: 'Parmesan', category: 'Produits laitiers', aliases: ['parmigiano'] },
    { name: 'Feta', category: 'Produits laitiers', aliases: [] },
    { name: 'Chèvre', category: 'Produits laitiers', aliases: ['chevre', 'goat cheese', 'fromage de chèvre'] },
    { name: 'Yaourts', category: 'Produits laitiers', aliases: ['yaourt', 'yogurt', 'yoghurt', 'yogourt'] },
    { name: 'Yaourt nature', category: 'Produits laitiers', aliases: ['yaourts nature', 'plain yogurt'] },
    { name: 'Œufs', category: 'Produits laitiers', aliases: ['oeufs', 'oeuf', 'œuf', 'egg', 'eggs'] },
    { name: 'Margarine', category: 'Produits laitiers', aliases: [] },

    // Viandes et Poulet
    { name: 'Poulet', category: 'Viandes et Poulet', aliases: ['chicken', 'poulets'] },
    { name: 'Escalopes de poulet', category: 'Viandes et Poulet', aliases: ['escalope de poulet', 'chicken breast'] },
    { name: 'Cuisses de poulet', category: 'Viandes et Poulet', aliases: ['cuisse de poulet', 'chicken thighs'] },
    { name: 'Ailes de poulet', category: 'Viandes et Poulet', aliases: ['aile de poulet', 'chicken wings'] },
    { name: 'Bœuf', category: 'Viandes et Poulet', aliases: ['boeuf', 'beef'] },
    { name: 'Steak haché', category: 'Viandes et Poulet', aliases: ['steaks hachés', 'ground beef', 'viande hachée'] },
    { name: 'Entrecôte', category: 'Viandes et Poulet', aliases: ['entrecote', 'ribeye'] },
    { name: 'Rôti de bœuf', category: 'Viandes et Poulet', aliases: ['roti de boeuf', 'beef roast'] },
    { name: 'Porc', category: 'Viandes et Poulet', aliases: ['pork'] },
    { name: 'Côtes de porc', category: 'Viandes et Poulet', aliases: ['cote de porc', 'pork chops'] },
    { name: 'Jambon', category: 'Viandes et Poulet', aliases: ['jambons', 'ham'] },
    { name: 'Jambon blanc', category: 'Viandes et Poulet', aliases: ['white ham'] },
    { name: 'Lardons', category: 'Viandes et Poulet', aliases: ['lardon', 'bacon bits'] },
    { name: 'Bacon', category: 'Viandes et Poulet', aliases: [] },
    { name: 'Saucisses', category: 'Viandes et Poulet', aliases: ['saucisse', 'sausage', 'sausages'] },
    { name: 'Merguez', category: 'Viandes et Poulet', aliases: [] },
    { name: 'Agneau', category: 'Viandes et Poulet', aliases: ['lamb'] },
    { name: 'Dinde', category: 'Viandes et Poulet', aliases: ['turkey', 'dindes'] },
    { name: 'Canard', category: 'Viandes et Poulet', aliases: ['duck'] },
    { name: 'Veau', category: 'Viandes et Poulet', aliases: ['veal'] },

    // Épicerie
    { name: 'Pâtes', category: 'Épicerie', aliases: ['pates', 'pasta', 'spaghetti', 'spaghettis'] },
    { name: 'Riz', category: 'Épicerie', aliases: ['rice'] },
    { name: 'Riz basmati', category: 'Épicerie', aliases: ['basmati rice', 'basmati'] },
    { name: 'Quinoa', category: 'Épicerie', aliases: [] },
    { name: 'Couscous', category: 'Épicerie', aliases: [] },
    { name: 'Farine', category: 'Épicerie', aliases: ['flour'] },
    { name: 'Sucre', category: 'Épicerie', aliases: ['sugar'] },
    { name: 'Sel', category: 'Épicerie', aliases: ['salt'] },
    { name: 'Poivre', category: 'Épicerie', aliases: ['pepper'] },
    { name: 'Huile d\'olive', category: 'Épicerie', aliases: ['huile olive', 'olive oil'] },
    { name: 'Huile de tournesol', category: 'Épicerie', aliases: ['huile tournesol', 'sunflower oil'] },
    { name: 'Vinaigre', category: 'Épicerie', aliases: ['vinegar', 'vinaigre balsamique'] },
    { name: 'Moutarde', category: 'Épicerie', aliases: ['mustard'] },
    { name: 'Mayonnaise', category: 'Épicerie', aliases: ['mayo'] },
    { name: 'Ketchup', category: 'Épicerie', aliases: [] },
    { name: 'Sauce tomate', category: 'Épicerie', aliases: ['tomato sauce', 'coulis de tomates'] },
    { name: 'Sauce soja', category: 'Épicerie', aliases: ['soy sauce'] },
    { name: 'Miel', category: 'Épicerie', aliases: ['honey'] },
    { name: 'Confiture', category: 'Épicerie', aliases: ['confitures', 'jam'] },
    { name: 'Nutella', category: 'Épicerie', aliases: ['pâte à tartiner', 'pate a tartiner'] },
    { name: 'Céréales', category: 'Épicerie', aliases: ['cereales', 'cereal', 'cereals'] },
    { name: 'Corn flakes', category: 'Épicerie', aliases: ['cornflakes'] },
    { name: 'Muesli', category: 'Épicerie', aliases: [] },
    { name: 'Chocolat', category: 'Épicerie', aliases: ['chocolate'] },
    { name: 'Chocolat noir', category: 'Épicerie', aliases: ['dark chocolate'] },
    { name: 'Biscuits', category: 'Épicerie', aliases: ['biscuit', 'cookies', 'cookie'] },
    { name: 'Chips', category: 'Épicerie', aliases: ['crisps'] },
    { name: 'Cacahuètes', category: 'Épicerie', aliases: ['cacahuete', 'peanuts', 'arachides'] },
    { name: 'Amandes', category: 'Épicerie', aliases: ['amande', 'almonds'] },
    { name: 'Noix', category: 'Épicerie', aliases: ['walnuts'] },
    { name: 'Noisettes', category: 'Épicerie', aliases: ['noisette', 'hazelnuts'] },
    { name: 'Olives', category: 'Épicerie', aliases: ['olive'] },
    { name: 'Câpres', category: 'Épicerie', aliases: ['capres', 'capers'] },
    { name: 'Cornichons', category: 'Épicerie', aliases: ['cornichon', 'pickles'] },
    { name: 'Thon', category: 'Épicerie', aliases: ['tuna', 'thon en boîte'] },
    { name: 'Sardines', category: 'Épicerie', aliases: ['sardine'] },

    // Surgelés
    { name: 'Pizza surgelée', category: 'Surgelés', aliases: ['pizzas surgelées', 'frozen pizza'] },
    { name: 'Frites surgelées', category: 'Surgelés', aliases: ['frites', 'frozen fries', 'french fries'] },
    { name: 'Légumes surgelés', category: 'Surgelés', aliases: ['frozen vegetables'] },
    { name: 'Glace', category: 'Surgelés', aliases: ['glaces', 'ice cream', 'crème glacée'] },
    { name: 'Poisson surgelé', category: 'Surgelés', aliases: ['frozen fish'] },
    { name: 'Nuggets', category: 'Surgelés', aliases: ['chicken nuggets'] },
    { name: 'Cordons bleus', category: 'Surgelés', aliases: ['cordon bleu'] },

    // Boissons
    { name: 'Eau', category: 'Boissons', aliases: ['water', 'eau minérale', 'eau minerale'] },
    { name: 'Jus d\'orange', category: 'Boissons', aliases: ['jus orange', 'orange juice'] },
    { name: 'Jus de pomme', category: 'Boissons', aliases: ['jus pomme', 'apple juice'] },
    { name: 'Coca', category: 'Boissons', aliases: ['coca-cola', 'coca cola', 'coke'] },
    { name: 'Limonade', category: 'Boissons', aliases: ['lemonade'] },
    { name: 'Bière', category: 'Boissons', aliases: ['biere', 'bieres', 'bières', 'beer', 'beers'] },
    { name: 'Vin', category: 'Boissons', aliases: ['vins', 'wine', 'wines'] },
    { name: 'Vin rouge', category: 'Boissons', aliases: ['red wine'] },
    { name: 'Vin blanc', category: 'Boissons', aliases: ['white wine'] },
    { name: 'Café', category: 'Boissons', aliases: ['cafe', 'coffee'] },
    { name: 'Thé', category: 'Boissons', aliases: ['the', 'tea'] },
    { name: 'Tisane', category: 'Boissons', aliases: ['tisanes', 'herbal tea'] },
    { name: 'Sirop', category: 'Boissons', aliases: ['sirops', 'syrup'] },

    // Hygiène
    { name: 'Savon', category: 'Hygiène', aliases: ['savons', 'soap'] },
    { name: 'Shampooing', category: 'Hygiène', aliases: ['shampoing', 'shampoo'] },
    { name: 'Gel douche', category: 'Hygiène', aliases: ['shower gel', 'body wash'] },
    { name: 'Dentifrice', category: 'Hygiène', aliases: ['toothpaste'] },
    { name: 'Brosse à dents', category: 'Hygiène', aliases: ['brosse a dents', 'toothbrush'] },
    { name: 'Déodorant', category: 'Hygiène', aliases: ['deodorant', 'deo'] },
    { name: 'Papier toilette', category: 'Hygiène', aliases: ['papier wc', 'toilet paper', 'pq'] },
    { name: 'Mouchoirs', category: 'Hygiène', aliases: ['mouchoir', 'tissues', 'kleenex'] },
    { name: 'Cotons', category: 'Hygiène', aliases: ['coton', 'cotton pads'] },
    { name: 'Rasoirs', category: 'Hygiène', aliases: ['rasoir', 'razor', 'razors'] },
    { name: 'Crème hydratante', category: 'Hygiène', aliases: ['creme hydratante', 'moisturizer'] },
    { name: 'Lessive', category: 'Hygiène', aliases: ['detergent', 'laundry detergent'] },
    { name: 'Adoucissant', category: 'Hygiène', aliases: ['fabric softener'] },
    { name: 'Liquide vaisselle', category: 'Hygiène', aliases: ['dish soap'] },
    { name: 'Éponges', category: 'Hygiène', aliases: ['eponge', 'eponges', 'sponge', 'sponges'] },

    // Conserves
    { name: 'Tomates pelées', category: 'Conserves', aliases: ['tomates pelees', 'peeled tomatoes', 'tomates en boîte'] },
    { name: 'Haricots rouges', category: 'Conserves', aliases: ['haricot rouge', 'red beans', 'kidney beans'] },
    { name: 'Haricots blancs', category: 'Conserves', aliases: ['haricot blanc', 'white beans'] },
    { name: 'Pois chiches', category: 'Conserves', aliases: ['pois chiche', 'chickpeas'] },
    { name: 'Lentilles', category: 'Conserves', aliases: ['lentille', 'lentils'] },
    { name: 'Maïs', category: 'Conserves', aliases: ['mais', 'corn'] },
    { name: 'Petits pois', category: 'Conserves', aliases: ['petit pois', 'peas'] },
    { name: 'Champignons en boîte', category: 'Conserves', aliases: ['canned mushrooms'] },
    { name: 'Soupe', category: 'Conserves', aliases: ['soupes', 'soup'] },

    // Vaiselle Jetable
    // Fourchettes, cuillères, couteaux, etc.
    { name: 'Fourchettes', category: 'Vaiselle Jetable', aliases: ['fourchette', 'forchette', 'forchet'] },
    { name: 'Cuillères', category: 'Vaiselle Jetable', aliases: ['cuillère', 'cuillere', 'cuileres'] },
    { name: 'Couteaux', category: 'Vaiselle Jetable', aliases: ['couteau', 'couteaux'] },
    { name: 'Pinces', category: 'Vaiselle Jetable', aliases: ['pince', 'pincees'] },
    { name: 'Serviettes', category: 'Vaiselle Jetable', aliases: ['serviette', 'serviettes', 'servietes', 'serviete'] },
    { name: 'Couverts', category: 'Vaiselle Jetable', aliases: ['couvert', 'couverts'] },
    { name: 'Assiettes jetables', category: 'Vaiselle Jetable', aliases: ['assiette jetable', 'disposable plates'] },
    { name: 'Gobelets', category: 'Vaiselle Jetable', aliases: ['gobelet', 'cups', 'plastic cups'] },
    { name: 'Serviettes en papier', category: 'Vaiselle Jetable', aliases: ['serviette papier', 'paper napkins', 'napkins'] },
    { name: 'Couverts jetables', category: 'Vaiselle Jetable', aliases: ['couvert jetable', 'disposable cutlery'] },
    { name: 'Film alimentaire', category: 'Vaiselle Jetable', aliases: ['cling film', 'plastic wrap'] },
    { name: 'Papier aluminium', category: 'Vaiselle Jetable', aliases: ['alu', 'aluminum foil', 'foil'] },
    { name: 'Sacs poubelle', category: 'Vaiselle Jetable', aliases: ['sac poubelle', 'trash bags', 'garbage bags'] },
];

async function seed() {
    console.log('🌱 Seeding database (respects existing data)...');
    
    // Insert categories - DO NOTHING if exists (preserve user changes)
    console.log('📁 Inserting default categories...');
    const categoryMap = {};
    let newCategories = 0;
    
    for (const cat of categories) {
        try {
            // First, check if category exists
            const existing = await pool.query(
                'SELECT id FROM categories WHERE LOWER(name) = LOWER($1)',
                [cat.name]
            );
            
            if (existing.rows.length > 0) {
                // Category exists - use existing ID, don't overwrite
                categoryMap[cat.name] = existing.rows[0].id;
            } else {
                // Category doesn't exist - insert it
                const result = await pool.query(
                    `INSERT INTO categories (name, icon, sort_order) 
                     VALUES ($1, $2, $3) 
                     RETURNING id`,
                    [cat.name, cat.icon, cat.sort_order]
                );
                categoryMap[cat.name] = result.rows[0].id;
                newCategories++;
            }
        } catch (error) {
            console.error(`Error with category ${cat.name}:`, error.message);
        }
    }
    console.log(`✅ Categories: ${newCategories} new, ${Object.keys(categoryMap).length - newCategories} existing`);

    // Insert products - DO NOTHING if exists (preserve user changes)
    console.log('📦 Inserting default products...');
    let newProducts = 0;
    let newAliases = 0;

    for (const product of products) {
        const categoryId = categoryMap[product.category];
        if (!categoryId) {
            console.warn(`Category not found for ${product.name}: ${product.category}`);
            continue;
        }

        try {
            // Check if product exists
            const existing = await pool.query(
                'SELECT id FROM products WHERE LOWER(name) = LOWER($1)',
                [product.name]
            );
            
            let productId;
            if (existing.rows.length > 0) {
                // Product exists - use existing, don't overwrite
                productId = existing.rows[0].id;
            } else {
                // Product doesn't exist - insert it
                const result = await pool.query(
                    `INSERT INTO products (name, category_id) 
                     VALUES ($1, $2) 
                     RETURNING id`,
                    [product.name, categoryId]
                );
                productId = result.rows[0].id;
                newProducts++;
            }

            // Insert aliases - only if they don't exist
            for (const alias of product.aliases) {
                if (!alias) continue;
                try {
                    const aliasResult = await pool.query(
                        `INSERT INTO product_aliases (product_id, alias) 
                         VALUES ($1, $2) 
                         ON CONFLICT (alias) DO NOTHING
                         RETURNING id`,
                        [productId, alias.toLowerCase()]
                    );
                    if (aliasResult.rows.length > 0) {
                        newAliases++;
                    }
                } catch (error) {
                    // Ignore errors
                }
            }
        } catch (error) {
            console.error(`Error with product ${product.name}:`, error.message);
        }
    }

    console.log(`✅ Products: ${newProducts} new`);
    console.log(`✅ Aliases: ${newAliases} new`);
    console.log('🎉 Seed complete!');
}

if (require.main === module) {
    seed()
        .then(() => pool.end())
        .catch(err => {
            console.error('Seed failed:', err);
            pool.end();
            process.exit(1);
        });
}

module.exports = { seed, products };

