import express from "express";
import {
  createInvoice,
  editInvoice,
  getAllInvoices,
  getSingleInvoices,
  deleteInvoice,
} from "../controllers/payments.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/add-invoice", authMiddleware, createInvoice);
router.get("/get-all-invoices", authMiddleware, getAllInvoices);
router.get("/get-single-invoice/:id", authMiddleware, getSingleInvoices);
router.put("/edit-invoice/:id", authMiddleware, editInvoice);
router.delete("/delete-invoice/:id", authMiddleware, deleteInvoice);

export default router;
