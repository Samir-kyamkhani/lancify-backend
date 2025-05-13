import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";

const authenticateUser = async (req, __, next) => {
  try {
    const accessToken =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!accessToken) {
      throw new ApiError("Access token is missing or invalid.", 401);
    }

    const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);

    if (!decoded) {
      throw new ApiError("Invalid token. Unauthorized access.", 401);
    }

    const { password, ...userWithoutPassword } = decoded;
    req.user = userWithoutPassword;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(new ApiError("Access token has expired.", 401));
    }

    return next(new ApiError("Unauthorized access.", 401));
  }
};

export { authenticateUser };
