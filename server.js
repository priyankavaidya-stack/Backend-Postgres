const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { Pool } = require("pg"); //
const data = require('./data');

// Load env variables
dotenv.config();

// Initialize express
const app = express();
const port = process.env.PORT || 4000;

// PostgreSQL connection setup using Pool
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
});

// Test connection on startup
pool.connect()
    .then(()=>{
        console.log("Successfully connected to PostgreSQL!");
    })
    .catch((err)=>{
        console.error('Error connecting to PostgreSQL: ', err);
    });

// Middlewares
app.use(cors());
app.use(express.json());

// Function to insert data into the database
const insertData = async () => {
    try {
        // Insert multiple rows using a single query
        const queryText = `INSERT INTO products (product_name, product_img, description, price, ratings) VALUES ($1, $2, $3, $4, $5)`;

        // Loop through each product in the data array and insert it into the database
        for(let product of data) {
            const values = [
                product.product_name,
                product.product_img,
                product.description,
                product.price,
                product.ratings
            ];

            // Insert data for each product
            await pool.query(queryText, values)
        }
        console.log('Data inserted successfully!');
    } catch (error) {
        console.error('Error inserting data:', error);
    }
}

// ********** API *******************
// Endpoint to trigger data insertion
app.post('/api/insert-data', async(req, res)=>{
    try {
        await insertData();
        res.status(200).json({ message: 'Data inserted successfully!' });
    } catch (error) {
        console.error('Error inserting data: ', error);
        res.status(500).json({ error: 'Failed to insert data into the database' });
    }
});

// API to check database connection
// app.get('/api', async (req, res)=>{
//     try {
//         const result = await pool.query('SELECT NOW()');
//         res.json(result.rows);
//     } catch (error) {
//         console.error('Error querying PostgreSQL:', error);
//         res.status(500).json({ error: 'Failed to query PostgreSQL' });
//     }
// });

// API for fetching the products from database
app.get('/api/products', async (req, res)=>{
    try {
        const result = await pool.query('SELECT * FROM products');
        const data = result.rows;
        // console.log(data);
        res.status(200).json(data);
    } catch (error) {
        console.log('Error getting the list of products:', error);
        res.status(500).json({ error: 'Failed to fetch the data from PostgreSQL' });
    }
})

// CART API Endpoints to handle cart operations
app.post('/api/cart/add', async (req, res) => {
    try {
        const { product_id, session_id} = req.body;
        // Fetch product details from the database
        const productQuery = 'SELECT * FROM products WHERE product_id = $1';
        const productResult = await pool.query(productQuery, [product_id]);

        if(productResult.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Insert into cart table
        const cartInsertQuery = 'INSERT INTO cart_items (product_id, session_id, quantity) VALUES ($1, $2, $3)';
        await pool.query(cartInsertQuery, [product_id, session_id, 1]);
    
        // Fetch updated cart items
        const cartQuery = 'SELECT * FROM cart_items WHERE session_id = $1';
        const cartResults = await pool.query(cartQuery, [session_id]);

        res.json(cartResults.rows);
    } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(500).json({ error: 'Failed to add to cart' });
    }
});

// API to fetch cart items
app.get('/api/cart/:sessionId', async (req, res) => {
    try{
        const { sessionId } = req.params;
        const cartQuery = `
            SELECT ci.*, p.* 
            FROM cart_items ci 
            JOIN products p ON ci.product_id = p.product_id 
            WHERE ci.session_id = $1
        `;

        const result = await pool.query(cartQuery, [sessionId]);
        res.json(result.rows);
    } catch(error) {
        console.error('Error fetching cart items:', error);
        res.status(500).json({ error: 'Failed to fetch cart items' });
    }
})

// API to remove product from cart
app.post('/api/cart/remove/:itemId', async (req, res) => {
    try {
        const { itemId } = req.params;
        const deleteQuery = `DELETE FROM cart_items WHERE product_id = $1 RETURNING *`;
        const deleteResult = await pool.query(deleteQuery, [itemId]);

        if(deleteResult.rowCount === 0) {
            return res.status(404).json({ error: 'Item not found in cart '});
        }

        const sessionId = deleteResult.rows[0].session_id;

        // Then, fetch the updated cart (optional, for frontend sync)
        const updatedCartQuery = `
            SELECT ci.*, p.product_name, p.product_img, p.description, p.price
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.product_id
            WHERE ci.session_id = $1
        `;
        const updatedCart = await pool.query(updatedCartQuery, [sessionId]);

        res.status(200).json(updatedCart.rows);

    } catch (error) {
        console.error('Error removing the item from cart', error);
        res.status(500).json({ error: 'Failed to remove item from cart' });
    }
});

app.post('/api/cart/incrementQty/:itemId', async (req, res) => {
    try {
        const { itemId } = req.params;
        // Step 1: Check if item exists in cart_items
        const checkQuery = `SELECT * FROM cart_items WHERE product_id = $1`;
        const checkResult = await pool.query(checkQuery, [itemId]);

        console.log(checkQuery, "CheckQuery")
        if(checkResult.rowCount === 0) {
            return res.status(404).json({ error: 'Item not found in cart '});
        }

        // Step 2: Increment quantity
        const updateQuery = `UPDATE cart_items SET quantity = quantity + 1 WHERE product_id = $1 RETURNING *`;
        const updateResult = await pool.query(updateQuery, [itemId]);

        // Step 3: Fetch updated cart for that session
        const sessionId = updateResult.rows[0].session_id;
        const cartQuery = `
            SELECT ci.*, p.product_name, p.product_img, p.description, p.price
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.product_id
            WHERE ci.session_id = $1
        `;
        const updatedCart = await pool.query(cartQuery, [sessionId]);

        res.status(200).json(updatedCart.rows);

    } catch (error) {
        console.error('Error increasing the qty of product in cart', error);
        res.status(500).json({ error: 'Failed to increase the qty in cart' });
    }
})

app.post('/api/cart/decrementQty/:itemId', async (req, res) => {
    try {
        const { itemId } = req.params;
        // Step 1: Check if item exists in cart_items
        const checkQuery = `SELECT * FROM cart_items WHERE product_id = $1`;
        const checkResult = await pool.query(checkQuery, [itemId]);

        if(checkResult.rowCount === 0) {
            return res.status(404).json({ error: 'Item not found in cart '});
        }

        // Step 2: Increment quantity
        const updateQuery = `UPDATE cart_items SET quantity = quantity - 1 WHERE product_id = $1 RETURNING *`;
        const updateResult = await pool.query(updateQuery, [itemId]);

        // Step 3: Fetch updated cart for that session
        const sessionId = updateResult.rows[0].session_id;
        const cartQuery = `
            SELECT ci.*, p.product_name, p.product_img, p.description, p.price
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.product_id
            WHERE ci.session_id = $1
        `;
        const updatedCart = await pool.query(cartQuery, [sessionId]);
        console.log("Updated Cart", updatedCart);
        res.status(200).json(updatedCart.rows);

    } catch (error) {
        console.error('Error decreasing the qty of product in cart', error);
        res.status(500).json({ error: 'Failed to decrease the qty in cart' });
    }
})

app.post('/api/wishlist/toggle', async (req, res) => {
    try {
        const { product_id, session_id} = req.body;
        // Fetch product details from the database
        const checkQuery = `SELECT * FROM wishlist_items WHERE product_id = $1 AND session_id = $2`;
        const result = await pool.query(checkQuery, [product_id, session_id]);

        if(result.rows.length > 0) {
            // Product exists in wishlist — remove it
            const removeQuery = `DELETE FROM wishlist_items WHERE product_id = $1 AND session_id = $2`;
            await pool.query(removeQuery, [product_id, session_id])
        } else {
            // Product not in wishlist — add it
            const addQuery = `INSERT INTO wishlist_items (product_id, session_id) VALUES ($1, $2)`;
            await pool.query(addQuery, [product_id, session_id])
        }

        // Return updated wishlist
        const updatedList = await pool.query(`
            SELECT w.*, p.product_name, p.price, p.product_img
            FROM wishlist_items w
            JOIN products p ON w.product_id = p.product_id
            WHERE w.session_id = $1
        `, [session_id]);

        res.json(updatedList.rows);
    } catch (error) {
        console.error('Error adding item to the wishlist', error);
    }
})

// API to fetch cart items
app.get('/api/wishlist/:sessionId', async (req, res) => {
    try{
        const { sessionId } = req.params;
        const listQuery = `
            SELECT wi.*, p.* 
            FROM wishlist_items wi 
            JOIN products p ON wi.product_id = p.product_id 
            WHERE wi.session_id = $1
        `;

        const result = await pool.query(listQuery, [sessionId]);
        console.log("result", result);
        res.json(result.rows);
    } catch(error) {
        console.error('Error fetching wishlist items:', error);
        res.status(500).json({ error: 'Failed to fetch wishlist items' });
    }
})

// Start server
app.listen(port, ()=>{
    console.log(`Server is listening on port ${port}`);
});