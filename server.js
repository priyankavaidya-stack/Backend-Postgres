const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { Client, Pool } = require("pg"); //
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
        const queryText = `INSERT INTO products (product_name, product_img, description, price, ratings, isadded, isfavourite) VALUES ($1, $2, $3, $4, $5, $6, $7)`;

        // Loop through each product in the data array and insert it into the database
        for(let product of data) {
            const values = [
                product.product_name,
                product.product_img,
                product.description,
                product.price,
                product.ratings,
                product.isAdded,
                product.isFavourite
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
app.get('/api', async (req, res)=>{
    try {
        const result = await pool.query('SELECT NOW()');
        res.json(result.rows);
    } catch (error) {
        console.error('Error querying PostgreSQL:', error);
        res.status(500).json({ error: 'Failed to query PostgreSQL' });
    }
});

// Start server
app.listen(port, ()=>{
    console.log(`Server is listening on port ${port}`);
})