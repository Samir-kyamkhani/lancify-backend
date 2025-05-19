import { ApiError } from "../utils/ApiError.js";

const authorizeRolesMiddleware = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json(ApiError.send(res, 403, "Access denied."));
    }
    next();
  };
};

export { authorizeRolesMiddleware };
