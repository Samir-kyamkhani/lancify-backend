import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { createTask } from "../controllers/Taskboard.controller.js";

const router = Router();

router.post("/create-task", authMiddleware, createTask);
// router.put("/update-proposal/:id", authMiddleware, updateProposal);
// router.get("/get-all-proposals", authMiddleware, getAllProposals);
// router.get("/get-proposal/:id", authMiddleware, getProposalById);
// router.delete("/delete-proposal/:id", authMiddleware, deleteProposal);

export default router;
