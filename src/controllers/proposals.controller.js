import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import prisma from "../database/db.config.js";
import validator from "validator";

const ALLOWED_STATUSES = ["draft", "sent", "accepted", "rejected", "expired"];
const ALLOWED_TONES = [
  "formal",
  "informal",
  "professional",
  "casual",
  "friendly",
];

const isValidTags = (tags) =>
  Array.isArray(tags) && tags.every((tag) => typeof tag === "string");

// ========== Create ==========

export const createProposal = asyncHandler(async (req, res) => {
  const {
    clientId,
    projectName,
    amount,
    date,
    agency,
    status,
    clientNeeds,
    proposedServices,
    tone,
    generatedContent,
    expertise: tags = [],
  } = req.body;

  const { id: userId } = req.user;

  // ========== Required Validations ==========
  if (!clientId || !status) {
    return ApiError.send(res, 400, "clientId and status are required.");
  }

  // Validate client ID format (UUID)
  if (!validator.isUUID(clientId)) {
    return ApiError.send(res, 400, "Invalid clientId format.");
  }

  if (userId && !validator.isUUID(userId)) {
    return ApiError.send(res, 400, "Invalid userId format.");
  }

  // ========== Enum Validations ==========
  if (!ALLOWED_STATUSES.includes(status.trim())) {
    return ApiError.send(
      res,
      400,
      `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(", ")}`,
    );
  }

  if (tone && !ALLOWED_TONES.includes(tone.trim())) {
    return ApiError.send(
      res,
      400,
      `Invalid tone. Allowed values: ${ALLOWED_TONES.join(", ")}`,
    );
  }

  // ========== Type & Format Validations ==========
  if (amount !== undefined) {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) {
      return ApiError.send(res, 400, "Amount must be a valid number.");
    }
  }

  if (date && isNaN(Date.parse(date))) {
    return ApiError.send(res, 400, "Invalid date format.");
  }

  if (tags && !isValidTags(tags)) {
    return ApiError.send(res, 400, "Tags must be an array of strings.");
  }

  // ========== Existence Checks ==========
  const clientExists = await prisma.client.findUnique({
    where: { id: clientId },
  });
  if (!clientExists) {
    return ApiError.send(res, 400, "Client not found.");
  }

  if (userId) {
    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) {
      return ApiError.send(res, 400, "User not found.");
    }
  }

  // ========== Process Tags ==========
  const tagRecords = await Promise.all(
    tags.map(async (tagName) => {
      let tag = await prisma.tag.findFirst({ where: { name: tagName } });
      if (!tag) {
        tag = await prisma.tag.create({ data: { name: tagName } });
      }
      return tag;
    }),
  );

  // ========== Create Proposal ==========
  const newProposal = await prisma.proposal.create({
    data: {
      clientId,
      userId,
      projectName,
      date: date ? new Date(date) : undefined,
      amount: amount !== undefined ? parseFloat(amount) : undefined,
      agency,
      status: status.trim(),
      clientNeeds,
      proposedServices,
      tone: tone ? tone.trim() : undefined,
      generatedContent,
      tags: {
        create: tagRecords.map((tag) => ({
          tag: {
            connect: { id: tag.id },
          },
        })),
      },
    },
    include: {
      tags: {
        include: { tag: true },
      },
    },
  });

  const proposalWithTags = {
    ...newProposal,
    tags: newProposal.tags.map((t) => t.tag),
  };

  return res
    .status(201)
    .json(
      new ApiResponse(201, "Proposal created successfully", proposalWithTags),
    );
});

// ========== GET ALL ==========
export const getAllProposals = asyncHandler(async (req, res) => {
  const proposals = await prisma.proposal.findMany({
    include: { tags: { include: { tag: true } }, client: true },
    orderBy: { createdAt: "desc" },
  });

  const formatted = proposals.map((p) => ({
    ...p,
    tags: p.tags.map((t) => t.tag),
  }));

  res
    .status(200)
    .json(new ApiResponse(200, "All proposals retrieved", formatted));
});

// ========== GET ONE ==========
export const getProposalById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  console.log("Body:", id);

  if (!validator.isUUID(id))
    return ApiError.send(res, 400, "Invalid proposal ID");

  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } }, client: true },
  });

  if (!proposal) return ApiError.send(res, 400, "Proposal not found.");

  res.status(200).json(
    new ApiResponse(200, "Proposal retrieved", {
      ...proposal,
      tags: proposal.tags.map((t) => t.tag),
    }),
  );
});

// ========== UPDATE ==========
export const updateProposal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    projectName,
    amount,
    date,
    agency,
    status,
    clientNeeds,
    proposedServices,
    tone,
    generatedContent,
    expertise: tags = [],
  } = req.body;

  // ========== ID Validation ==========
  if (!validator.isUUID(id)) {
    return ApiError.send(res, 400, "Invalid proposal ID format.");
  }

  // ========== Type & Format Validations ==========
  if (amount !== undefined) {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) {
      return ApiError.send(res, 400, "Amount must be a valid number.");
    }
  }

  if (date && isNaN(Date.parse(date))) {
    return ApiError.send(res, 400, "Invalid date format.");
  }

  if (status && !ALLOWED_STATUSES.includes(status.trim())) {
    return ApiError.send(
      res,
      400,
      `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(", ")}`,
    );
  }

  if (tone && !ALLOWED_TONES.includes(tone.trim())) {
    return ApiError.send(
      res,
      400,
      `Invalid tone. Allowed values: ${ALLOWED_TONES.join(", ")}`,
    );
  }

  if (tags && !Array.isArray(tags)) {
    return ApiError.send(res, 400, "Tags must be an array of strings.");
  }

  for (const tag of tags) {
    if (typeof tag !== "string" || tag.trim() === "") {
      return ApiError.send(res, 400, "Each tag must be a non-empty string.");
    }
  }

  // ========== Existence Check ==========
  const existingProposal = await prisma.proposal.findUnique({
    where: { id },
  });
  if (!existingProposal) {
    return ApiError.send(res, 400, "Proposal not found.");
  }

  // ========== Process Tags ==========
  const tagRecords = await Promise.all(
    tags.map(async (tagName) => {
      const trimmedName = tagName.trim();
      let tag = await prisma.tag.findFirst({ where: { name: trimmedName } });
      if (!tag) {
        tag = await prisma.tag.create({ data: { name: trimmedName } });
      }
      return tag;
    }),
  );

  // ========== Update Proposal ==========
  await prisma.proposal.update({
    where: { id },
    data: {
      projectName,
      amount: amount !== undefined ? parseFloat(amount) : undefined,
      date: date ? new Date(date) : undefined,
      agency,
      status: status ? status.trim() : undefined,
      clientNeeds,
      proposedServices,
      tone: tone ? tone.trim() : undefined,
      generatedContent,
      tags: {
        deleteMany: {}, // remove all existing tag relations
        create: tagRecords.map((tag) => ({
          tag: { connect: { id: tag.id } },
        })),
      },
    },
  });

  // ========== Fetch & Return Updated Proposal ==========
  const updatedProposal = await prisma.proposal.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      client: true,
    },
  });

  return res.status(200).json(
    new ApiResponse(200, "Proposal updated successfully", {
      ...updatedProposal,
      tags: updatedProposal.tags.map((t) => t.tag),
    }),
  );
});

// ========== DELETE ==========
export const deleteProposal = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!validator.isUUID(id))
    return ApiError.send(res, 400, "Invalid proposal ID");

  const proposal = await prisma.proposal.findUnique({ where: { id } });
  if (!proposal) return ApiError.send(res, 400, "Proposal not found.");

  await prisma.proposal.delete({ where: { id } });

  res.status(200).json(new ApiResponse(200, "Proposal deleted successfully"));
});
