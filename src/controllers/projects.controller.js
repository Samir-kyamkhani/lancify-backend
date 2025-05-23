import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import prisma from "../database/db.config.js";
import validator from "validator";

const ProjectStatus = {
  in_progress: "in_progress",
  not_started: "not_started",
  completed: "completed",
  cancelled: "cancelled",
};

const isValidProjectStatus = (status) =>
  Object.values(ProjectStatus).includes(status);

export const addProject = asyncHandler(async (req, res) => {
  const { clientId, title, description, startDate, endDate, status } = req.body;

  if (!clientId || !validator.isUUID(clientId, 4)) {
    return ApiError.send(res, 400, "Valid clientId is required.");
  }

  if (!status || !isValidProjectStatus(status)) {
    return ApiError.send(
      res,
      400,
      `Invalid status. Must be one of: ${Object.values(ProjectStatus).join(", ")}.`,
    );
  }

  if (startDate && isNaN(Date.parse(startDate))) {
    return ApiError.send(res, 400, "Invalid startDate.");
  }
  if (endDate && isNaN(Date.parse(endDate))) {
    return ApiError.send(res, 400, "Invalid endDate.");
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    return ApiError.send(res, 404, "Client not found.");
  }

  const newProject = await prisma.project.create({
    data: {
      clientId,
      title,
      description,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      status,
    },
  });

  return res
    .status(201)
    .json(new ApiResponse(201, "Project created successfully.", newProject));
});

export const editProject = asyncHandler(async (req, res) => {
  const projectId = req.params.id;

  if (!projectId || !validator.isUUID(projectId, 4)) {
    return ApiError.send(res, 400, "Invalid or missing project ID.");
  }

  const { clientId, title, description, startDate, endDate, status } = req.body;

  if (
    [clientId, title, description, startDate, endDate, status].every(
      (val) => val === undefined,
    )
  ) {
    return ApiError.send(
      res,
      400,
      "At least one field must be provided to update.",
    );
  }

  if (clientId !== undefined && !validator.isUUID(clientId, 4)) {
    return ApiError.send(res, 400, "Invalid clientId.");
  }

  if (status !== undefined && !isValidProjectStatus(status)) {
    return ApiError.send(
      res,
      400,
      `Invalid status. Must be one of: ${Object.values(ProjectStatus).join(", ")}.`,
    );
  }

  if (
    startDate !== undefined &&
    startDate !== null &&
    isNaN(Date.parse(startDate))
  ) {
    return ApiError.send(res, 400, "Invalid startDate.");
  }

  if (endDate !== undefined && endDate !== null && isNaN(Date.parse(endDate))) {
    return ApiError.send(res, 400, "Invalid endDate.");
  }

  const existingProject = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!existingProject) {
    return ApiError.send(res, 404, "Project not found.");
  }

  if (clientId !== undefined) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return ApiError.send(res, 404, "Client not found.");
    }
  }

  const updateData = {
    ...(clientId !== undefined && { clientId }),
    ...(title !== undefined && { title }),
    ...(description !== undefined && { description }),
    ...(startDate !== undefined && {
      startDate: startDate ? new Date(startDate) : null,
    }),
    ...(endDate !== undefined && {
      endDate: endDate ? new Date(endDate) : null,
    }),
    ...(status !== undefined && { status }),
  };

  const updatedProject = await prisma.project.update({
    where: { id: projectId },
    data: updateData,
  });

  return res
    .status(200)
    .json(
      new ApiResponse(200, "Project updated successfully.", updatedProject),
    );
});

export const deleteProject = asyncHandler(async (req, res) => {
  const projectId = req.params.id;

  if (!projectId || !validator.isUUID(projectId, 4)) {
    return ApiError.send(res, 400, "Invalid or missing project ID.");
  }

  const existingProject = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!existingProject) {
    return ApiError.send(res, 404, "Project not found.");
  }

  await prisma.project.delete({ where: { id: projectId } });

  return res
    .status(200)
    .json(new ApiResponse(200, "Project deleted successfully."));
});

export const getAllProjects = asyncHandler(async (req, res) => {
  const projects = await prisma.project.findMany({
    include: {
      client: true,
      tasks: true,
      invoices: true,
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Projects fetched successfully.", projects));
});
