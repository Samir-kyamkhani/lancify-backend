import { Router } from "express";
// import { upload } from "../middleware/multer.middleware.js";
// import { verifyJWT } from "../middleware/auth.middleware.js";
import { login, signup } from "../controllers/user.controller.js";
import { verifyOtp } from "../controllers/verifyOtp.controller.js";

const router = Router();

router.route("/signup").post(signup);
router.route("/login").post(login);
router.post("/verify-otp", verifyOtp);

export default router;
