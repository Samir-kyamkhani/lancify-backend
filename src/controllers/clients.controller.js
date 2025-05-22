import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import prisma from "../database/db.config.js";
import validator from "validator";

// Helper to validate tags array
const isValidTags = (tags) =>
  Array.isArray(tags) && tags.every((tag) => typeof tag === "string");

// Allowed client statuses from your Prisma enum
const validStatuses = ["active", "inactive", "potential", "lost"];

export const addClient = asyncHandler(async (req, res) => {
  const { name, email, phone, company, country, status, tags } = req.body;

  if (!name || !email || !phone || !company || !country || !status || !tags) {
    return ApiError.send(res, 400, "All fields are required.");
  }

  if (!validator.isEmail(email)) {
    return ApiError.send(res, 400, "Invalid email format.");
  }

  if (!validator.isMobilePhone(phone, "any")) {
    return ApiError.send(res, 400, "Invalid phone number.");
  }

  if (!validStatuses.includes(status)) {
    return ApiError.send(
      res,
      400,
      `Invalid status. Allowed: ${validStatuses.join(", ")}`,
    );
  }

  if (!isValidTags(tags)) {
    return ApiError.send(res, 400, "Tags must be an array of strings.");
  }

  const existingClient = await prisma.client.findFirst({
    where: {
      OR: [{ email }, { phone }],
    },
  });

  if (existingClient) {
    return ApiError.send(
      res,
      400,
      "Client already exists with the given email or phone.",
    );
  }

  const tagRecords = await Promise.all(
    tags.map(async (tagName) => {
      let tag = await prisma.tag.findFirst({ where: { name: tagName } });
      if (!tag) {
        tag = await prisma.tag.create({ data: { name: tagName } });
      }
      return tag;
    }),
  );

  const newClient = await prisma.client.create({
    data: {
      name,
      email,
      phone,
      company,
      country,
      status,

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

  const clientWithTags = {
    ...newClient,
    tags: newClient.tags.map((ct) => ct.tag),
  };

  return res
    .status(201)
    .json(new ApiResponse(201, "Client created successfully.", clientWithTags));
});

export const updateClient = asyncHandler(async (req, res) => {
  const clientId = req.params.id;
  const { name, email, phone, company, country, status, tags } = req.body;

  if (!clientId || !validator.isUUID(clientId)) {
    return ApiError.send(res, 400, "Invalid or missing client ID.");
  }

  if (![name, email, phone, company, country, status, tags].some(Boolean)) {
    return ApiError.send(
      res,
      400,
      "At least one field must be provided to update.",
    );
  }

  if (email && !validator.isEmail(email)) {
    return ApiError.send(res, 400, "Invalid email format.");
  }

  if (phone && !validator.isMobilePhone(phone, "any")) {
    return ApiError.send(res, 400, "Invalid phone number.");
  }

  if (status && !validStatuses.includes(status)) {
    return ApiError.send(
      res,
      400,
      `Invalid status. Allowed: ${validStatuses.join(", ")}`,
    );
  }

  if (tags && !isValidTags(tags)) {
    return ApiError.send(res, 400, "Tags must be an array of strings.");
  }

  const existingClient = await prisma.client.findUnique({
    where: { id: clientId },
  });

  if (!existingClient) {
    return ApiError.send(res, 404, "Client not found.");
  }

  if (email || phone) {
    const conflictClient = await prisma.client.findFirst({
      where: {
        OR: [
          email ? { email } : undefined,
          phone ? { phone } : undefined,
        ].filter(Boolean),
        NOT: { id: clientId },
      },
    });
    if (conflictClient) {
      return ApiError.send(
        res,
        400,
        "Another client exists with this email or phone.",
      );
    }
  }

  const updateData = {
    ...(name !== undefined && { name }),
    ...(email !== undefined && { email }),
    ...(phone !== undefined && { phone }),
    ...(company !== undefined && { company }),
    ...(country !== undefined && { country }),
    ...(status !== undefined && { status }),
  };

  if (tags) {
    await prisma.clientTag.deleteMany({ where: { clientId } });

    const tagRecords = await Promise.all(
      tags.map(async (tagName) => {
        let tag = await prisma.tag.findFirst({ where: { name: tagName } });
        if (!tag) {
          tag = await prisma.tag.create({ data: { name: tagName } });
        }
        return tag;
      }),
    );

    updateData.tags = {
      create: tagRecords.map((tag) => ({
        tag: { connect: { id: tag.id } },
      })),
    };
  }

  const updatedClient = await prisma.client.update({
    where: { id: clientId },
    data: updateData,
    include: {
      tags: {
        include: { tag: true },
      },
    },
  });

  const clientWithTags = {
    ...updatedClient,
    tags: updatedClient.tags.map((ct) => ct.tag),
  };

  return res
    .status(200)
    .json(new ApiResponse(200, "Client updated successfully.", clientWithTags));
});

export const getSingleClient = asyncHandler(async (req, res) => {
  const clientId = req.params.id;

  if (!clientId || !validator.isUUID(clientId)) {
    return ApiError.send(res, 400, "Invalid or missing client ID.");
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      tags: { include: { tag: true } },
    },
  });

  if (!client) {
    return ApiError.send(res, 404, "Client not found.");
  }

  const clientWithTags = {
    ...client,
    tags: client.tags.map((ct) => ct.tag),
  };

  return res
    .status(200)
    .json(new ApiResponse(200, "Client fetched successfully.", clientWithTags));
});

export const allClients = asyncHandler(async (req, res) => {
  const clients = await prisma.client.findMany({
    include: {
      tags: { include: { tag: true } },
    },
  });
  console.log(clients);

  const clientsWithTags = clients.map((client) => ({
    ...client,
    tags: client.tags.map((ct) => ct.tag),
  }));

  return res
    .status(200)
    .json(
      new ApiResponse(200, "Clients fetched successfully.", clientsWithTags),
    );
});

export const deleteClient = asyncHandler(async (req, res) => {
  const clientId = req.params.id;

  if (!clientId || !validator.isUUID(clientId)) {
    return ApiError.send(res, 400, "Invalid or missing client ID.");
  }

  const existingClient = await prisma.client.findUnique({
    where: { id: clientId },
  });

  if (!existingClient) {
    return ApiError.send(res, 404, "Client not found.");
  }

  await prisma.clientTag.deleteMany({ where: { clientId } });
  await prisma.client.delete({ where: { id: clientId } });

  return res
    .status(200)
    .json(new ApiResponse(200, "Client deleted successfully."));
});
