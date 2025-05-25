const router = require("express").Router()
const pool = require('../db');
const bcrypt = require("bcrypt");
const jwtGenerator = require("../utils/jwtGenerator");

// registering
router.post("/register", async(req, res) => {
    try {
        // 1. Destructure the req.body

        const { email, password} = req.body;

        // 2. Check if user exists (if user exists, throw error)

        const user = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);

        if(user.rows.length !== 0) {
            return res.status(401).send("User already exist");
        }

        // 3. Bcrypt the user password

        const saltRound = 10;
        const salt = await bcrypt.genSalt(saltRound);

        const bcryptPassword = await bcrypt.hash(password, salt);

        // 4. Enter the new user inside our database

        const newUser = await pool.query(`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *`, [email, bcryptPassword]);

        // res.json(newUser.rows[0]);

        // 5. Generating the jwt token

        const token = jwtGenerator(newUser.rows[0].user_id);

        res.json({ token });

    } catch (error) {
        console.error(error.message);
        res.status(500).send("Server Error");
    }
});

// login route
router.post("/login", async(req, res) => {
    try {
        // 1. Destructure the req.body

        const { email, password } = req.body;

         // 2. Check if user doesn't exists (if user doesn't exists, throw error)
        
        const user = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);

        if(user.rows.length === 0){
        return res.status(401).send("User doesn't exist");
        }

        // 3. Check if incoming password is same as database password

        const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);

        // console.log(validPassword);
        if(!validPassword) {
            return res.status(401).send("Password or Email is incorrect");
        }

        // 4. Give them jwt token
        const token = jwtGenerator(user.rows[0].user_id);

        res.json({ token });

    } catch (error) {
        console.error(error.message);
        res.status(500).send("Server Error");
    }
});

module.exports = router;