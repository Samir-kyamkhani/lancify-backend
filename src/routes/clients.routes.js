import { Router } from "express";
import {
  addClient,
  allClients,
  deleteClient,
  getSingleClient,
  updateClient,
} from "../controllers/clients.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/add-client", authMiddleware, addClient);
router.put("/edit-client/:id", authMiddleware, updateClient);
router.get("/get-all-clients", authMiddleware, allClients);
router.get("/:id", authMiddleware, getSingleClient);
router.delete("/delete-client/:id", authMiddleware, deleteClient);

export default router;
