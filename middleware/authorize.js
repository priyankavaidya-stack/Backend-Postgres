const jwt = require("jsonwebtoken");
require("dotenv").config();

//this middleware will on continue on if the token is inside the local storage
module.exports = async(req, res, next) => {
    try {
        // 1. Destructure the token
        const jwtToken = req.header("token");

        // 2. Check if token exists (if not, then throw error)
        if(!jwtToken){
            return res.status(403).json("Not Authorized");
        }

        // 3. Check if the token is valid
        const payload = jwt.verify(jwtToken, process.env.JWTSECRET);

        req.user = payload.user;
        next();

    } catch (error) {
        console.error(error.message);
        return res.status(401).json("Token is not valid");
    }
}