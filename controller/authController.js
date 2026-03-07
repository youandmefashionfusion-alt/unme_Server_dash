import jwt from 'jsonwebtoken';
import UserModel from '../models/userModel';
const authMiddleware = async (token, next) => {


    // Check if the token exists in the Authorization header
    if (token) {
        try {
            if (token) {
                // Verify the token
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await UserModel.findById(decoded?.id);
                
                if (user && user.role === "admin") {
                    // If user is an admin, proceed
                    console.log("user authorized")

                } else {
                    // If the user is not authorized, send a response and stop
                    return Response.json({status:403, message: "Not Authorized User" });
                }
            }
        } catch (error) {
            // If token is invalid or expired, send a response and stop
            throw new Error("error")
        }
    } else {
        // If no token is provided, send an error response
        throw new Error("No token attached");
    }
};


export default authMiddleware
