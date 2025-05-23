import express from "express";
import {
  addProject,
  deleteProject,
  editProject,
  getAllProjects,
} from "../controllers/projects.controller.js";

const router = express.Router();

router.post("/add-project", addProject);
router.put("/:id", editProject);
router.delete("/:id", deleteProject);
router.get("/", getAllProjects);

export default router;
