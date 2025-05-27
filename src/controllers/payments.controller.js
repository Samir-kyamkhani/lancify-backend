import prisma from "../database/db.config.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import validator from "validator";

// Utility to calculate gateway and software charges
const calculateCharges = (amount, paymentGateway, discountPercent = 0) => {
  const feesPercentMap = {
    razorpay: 2.35,
    paypal: 3.99,
  };

  const feePercent = feesPercentMap[paymentGateway.toLowerCase()] || 0;
  const softwareChargePercent = 5;

  const discountAmount = (discountPercent / 100) * amount;
  const subTotal = amount - discountAmount;

  const feesAmount = (feePercent / 100) * subTotal;
  const softwareChargeAmount = (softwareChargePercent / 100) * subTotal;

  const taxAmount = feesAmount + softwareChargeAmount;
  const total = subTotal + taxAmount;

  return {
    tax: `${feePercent.toFixed(2)}% fees + ${softwareChargePercent}% software charge included`,
    total: parseFloat(total.toFixed(2)),
  };
};

// ➕ Create Invoice
export const createInvoice = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) return ApiError.send(res, 401, "Unauthorized");

  const {
    invid,
    clientId,
    projectId,
    issueDate,
    dueDate,
    amount,
    discount = 0,
    notes,
    clientAddress,
    paymentGateway,
  } = req.body;

  // Validations
  if (!clientId) return ApiError.send(res, 400, "Client ID is required.");
  if (!projectId) return ApiError.send(res, 400, "Project ID is required.");
  if (!amount || isNaN(amount) || amount <= 0)
    return ApiError.send(res, 400, "A valid invoice amount is required.");
  if (!paymentGateway)
    return ApiError.send(res, 400, "Payment gateway is required.");

  const allowedGateways = ["razorpay", "paypal"];
  if (!allowedGateways.includes(paymentGateway.toLowerCase())) {
    return ApiError.send(
      res,
      400,
      `Payment gateway must be one of: ${allowedGateways.join(", ")}`,
    );
  }

  // Check unique invid
  if (invid) {
    const existingInvoice = await prisma.invoice.findUnique({
      where: { invid },
    });
    if (existingInvoice) {
      return ApiError.send(res, 409, "Invoice ID already exists.");
    }
  }

  const { tax, total } = calculateCharges(amount, paymentGateway, discount);
  const invoiceStatus = clientId ? "sent" : "draft";

  const invoiceData = {
    invid:
      invid ||
      `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
    userId,
    clientId,
    projectId,
    issueDate: issueDate ? new Date(issueDate) : new Date(),
    dueDate: dueDate ? new Date(dueDate) : null,
    amount: parseFloat(amount),
    discount: parseFloat(discount),
    total,
    status: invoiceStatus,
    paymentGateway: paymentGateway.toLowerCase(),
    notes: notes || null,
    clientAddress: clientAddress || null,
    tax,
  };

  const newInvoice = await prisma.invoice.create({ data: invoiceData });

  return res
    .status(201)
    .json(new ApiResponse(201, "Invoice created successfully.", newInvoice));
});

// ✏️ Edit Invoice
export const editInvoice = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { id } = req.params;

  if (!userId) return ApiError.send(res, 401, "Unauthorized");

  const {
    invid,
    clientId,
    projectId,
    issueDate,
    dueDate,
    amount,
    discount = 0,
    notes,
    clientAddress,
    paymentGateway,
  } = req.body;

  if (!clientId) return ApiError.send(res, 400, "Client ID is required.");
  if (!projectId) return ApiError.send(res, 400, "Project ID is required.");
  if (!amount || isNaN(amount) || amount <= 0)
    return ApiError.send(res, 400, "A valid invoice amount is required.");
  if (!paymentGateway)
    return ApiError.send(res, 400, "Payment gateway is required.");

  const allowedGateways = ["razorpay", "paypal"];
  if (!allowedGateways.includes(paymentGateway.toLowerCase())) {
    return ApiError.send(
      res,
      400,
      `Payment gateway must be one of: ${allowedGateways.join(", ")}`,
    );
  }

  const existingInvoice = await prisma.invoice.findUnique({ where: { id } });
  if (!existingInvoice) return ApiError.send(res, 404, "Invoice not found.");

  if (invid && invid !== existingInvoice.invid) {
    const duplicate = await prisma.invoice.findUnique({ where: { invid } });
    if (duplicate) return ApiError.send(res, 409, "Invoice ID already exists.");
  }

  const { tax, total } = calculateCharges(amount, paymentGateway, discount);

  const updatedInvoice = await prisma.invoice.update({
    where: { id },
    data: {
      invid: invid || existingInvoice.invid,
      clientId,
      projectId,
      issueDate: issueDate ? new Date(issueDate) : existingInvoice.issueDate,
      dueDate: dueDate ? new Date(dueDate) : null,
      amount: parseFloat(amount),
      discount: parseFloat(discount),
      total,
      tax,
      notes: notes || null,
      clientAddress: clientAddress || null,
      paymentGateway: paymentGateway.toLowerCase(),
      status: "sent",
    },
  });

  return res
    .status(200)
    .json(
      new ApiResponse(200, "Invoice updated successfully.", updatedInvoice),
    );
});

// 📄 Get All Invoices
export const getAllInvoices = asyncHandler(async (req, res) => {
  const invoices = await prisma.invoice.findMany();
  if (!invoices || invoices.length === 0) {
    return ApiError.send(res, 404, "No invoices found.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "Fetched all invoices successfully.", invoices));
});

// 👁️ Get Single Invoice with client & project
export const getSingleInvoices = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!validator.isUUID(id))
    return ApiError.send(res, 400, "Invalid invoice ID");

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      project: true,
      user: true,
    },
  });

  if (!invoice) return ApiError.send(res, 404, "Invoice not found.");

  return res
    .status(200)
    .json(new ApiResponse(200, "Fetched invoice successfully", invoice));
});

// delete
export const deleteInvoice = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { id } = req.params;

  // 🛡️ Authorization check
  if (!userId) return ApiError.send(res, 401, "Unauthorized");

  // ✅ Validate ID format
  if (!validator.isUUID(id)) {
    return ApiError.send(res, 400, "Invalid invoice ID format.");
  }

  // 📄 Check if invoice exists
  const invoice = await prisma.invoice.findUnique({ where: { id } });

  if (!invoice) {
    return ApiError.send(res, 404, "Invoice not found.");
  }

  // 🔐 (Optional) Ensure the invoice belongs to the user
  if (invoice.userId !== userId) {
    return ApiError.send(
      res,
      403,
      "You do not have permission to delete this invoice.",
    );
  }

  // 🧹 Delete invoice
  await prisma.invoice.delete({ where: { id } });

  // ✅ Respond with success
  return res
    .status(200)
    .json(new ApiResponse(200, "Invoice deleted successfully."));
});
