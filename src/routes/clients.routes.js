import { Router } from "express";
import {
  addClient,
  allClients,
  deleteClient,
  getSingleClient,
  updateClient,
} from "../controllers/clients.controller.js";
import { authorizeRolesMiddleware } from "../middlewares/authorizeRoles.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

router.post(
  "/add-client",
  authMiddleware,
  authorizeRolesMiddleware("admin"),
  addClient,
);
router.put(
  "/edit-client/:id",
  authMiddleware,
  authorizeRolesMiddleware("admin"),
  updateClient,
);
router.get(
  "/get-all-clients",
  authMiddleware,
  authorizeRolesMiddleware("admin"),
  allClients,
);
router.get(
  "/:id",
  authMiddleware,
  authorizeRolesMiddleware("admin"),
  getSingleClient,
);
router.delete(
  "/delete-client/:id",
  authMiddleware,
  authorizeRolesMiddleware("admin"),
  deleteClient,
);

export default router;
