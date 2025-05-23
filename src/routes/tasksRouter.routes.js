import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { createTask, deleteTask, getAllTasks, getTaskById, updateTask } from "../controllers/Taskboard.controller.js";

const router = Router();

router.post("/create-task", authMiddleware, createTask);
router.put("/update-task/:id", authMiddleware, updateTask);
router.get("/get-all-tasks", authMiddleware, getAllTasks);
router.get("/get-task/:id", authMiddleware, getTaskById);
router.delete("/delete-task/:id", authMiddleware, deleteTask);

export default router;
