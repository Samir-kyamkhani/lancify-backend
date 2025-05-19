import { Router } from "express";

// Controllers
import {
  forgotPassword,
  login,
  resendOtp,
  resetPassword,
  signup,
} from "../controllers/user.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { memberSignup } from "../controllers/teams.controller.js";
import { authorizeRolesMiddleware } from "../middlewares/authorizeRoles.js";

const router = Router();

router.post("/signup", signup);

router.post("/login", login);

router.post("/forgot-password", forgotPassword);

router.post("/resend-otp", resendOtp);
router.post("/reset-password", authMiddleware, resetPassword);

//team
router.post("/add-team-member",authMiddleware, authorizeRolesMiddleware("admin"), memberSignup);

export default router;
