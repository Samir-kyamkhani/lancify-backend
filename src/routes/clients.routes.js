import { Router } from "express";
import {
  addClient,
  allClients,
  deleteClient,
  getSingleClient,
  updateClient,
} from "../controllers/clients.controller.js";

const router = Router();

router.post("/add-client", addClient);
router.put("/edit-client/:id", updateClient);
router.get("/get-all-clients", allClients);
router.get("/:id", getSingleClient);
router.delete("/delete-client/:id", deleteClient);

export default router;
