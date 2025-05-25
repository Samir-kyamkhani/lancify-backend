import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import prisma from "../database/db.config.js";
import validator from "validator";

const ALLOWED_STATUSES = ["todo", "in_progress", "done", "blocked"];
const ALLOWED_PRIORITIES = ["low", "medium", "high", "critical"];

// ========== Create Task ==========
export const createTask = asyncHandler(async (req, res) => {
  const {
    project: projectId,
    assignee: userId,
    title,
    description,
    status,
    priority,
    dueDate,
  } = req.body;

  // Required field validation
  if (!projectId || !title || !status || !priority || !userId) {
    return ApiError.send(res, 400, "Required fields are missing.");
  }

  if (!validator.isUUID(projectId)) {
    return ApiError.send(res, 400, "Invalid Project ID format.");
  }

  if (!validator.isUUID(userId)) {
    return ApiError.send(res, 400, "Invalid User ID format.");
  }

  if (title.length < 3 || title.length > 100) {
    return ApiError.send(
      res,
      400,
      "Title must be between 3 and 100 characters.",
    );
  }

  if (!ALLOWED_STATUSES.includes(status)) {
    return ApiError.send(
      res,
      400,
      `Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}`,
    );
  }

  if (!ALLOWED_PRIORITIES.includes(priority)) {
    return ApiError.send(
      res,
      400,
      `Invalid priority. Allowed: ${ALLOWED_PRIORITIES.join(", ")}`,
    );
  }

  if (dueDate) {
    const due = new Date(dueDate);
    if (isNaN(due)) {
      return ApiError.send(res, 400, "Invalid due date format.");
    }
    if (due < new Date()) {
      return ApiError.send(res, 400, "Due date cannot be in the past.");
    }
  }

  // Ensure only admins can assign tasks
  // const requester = req.user;
  // if (!requester || requester.role !== "admin") {
  //   return ApiError.send(res, 403, "Only admins can assign tasks.");
  // }

  // Check existence
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return ApiError.send(res, 404, "Project not found.");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return ApiError.send(res, 404, "Assigned user not found.");
  }

  if (user.role !== "member") {
    return ApiError.send(
      res,
      400,
      "Task can only be assigned to users with role 'member'.",
    );
  }

  const task = await prisma.task.create({
    data: {
      projectId,
      userId,
      title,
      description,
      status,
      priority,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  });

  res
    .status(201)
    .json(new ApiResponse(201, "Task created successfully.", task));
});

// ========== Get All ==========
export const getAllTasks = asyncHandler(async (req, res) => {
  const tasks = await prisma.task.findMany({
    include: {
      user: true,
      project: true,
    },
  });

  res
    .status(200)
    .json(new ApiResponse(200, "Tasks fetched successfully.", tasks));
});

// ========== Get by ID ==========
export const getTaskById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      user: true,
      project: true,
    },
  });

  if (!task) return ApiError.send(res, 404, "Task not found.");

  res
    .status(200)
    .json(new ApiResponse(200, "Task fetched successfully.", task));
});

// ========== Update ==========
export const updateTask = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { projectId, userId, title, description, status, priority, dueDate } =
    req.body;

  const existingTask = await prisma.task.findUnique({ where: { id } });
  if (!existingTask) return ApiError.send(res, 404, "Task not found.");

  if (title && (title.length < 3 || title.length > 100)) {
    return ApiError.send(
      res,
      400,
      "Title must be between 3 and 100 characters.",
    );
  }

  if (status && !ALLOWED_STATUSES.includes(status)) {
    return ApiError.send(
      res,
      400,
      `Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}`,
    );
  }

  if (priority && !ALLOWED_PRIORITIES.includes(priority)) {
    return ApiError.send(
      res,
      400,
      `Invalid priority. Allowed: ${ALLOWED_PRIORITIES.join(", ")}`,
    );
  }

  if (dueDate) {
    const due = new Date(dueDate);
    if (isNaN(due)) {
      return ApiError.send(res, 400, "Invalid due date format.");
    }
    if (due < new Date()) {
      return ApiError.send(res, 400, "Due date cannot be in the past.");
    }
  }

  let assignedUser = null;
  if (userId) {
    // const requester = req.user;
    // if (!requester || requester.role !== "admin") {
    //   return ApiError.send(res, 403, "Only admins can reassign tasks.");
    // }

    assignedUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!assignedUser) {
      return ApiError.send(res, 404, "Assigned user not found.");
    }

    if (assignedUser.role !== "member") {
      return ApiError.send(
        res,
        400,
        "Task can only be assigned to users with role 'member'.",
      );
    }
  }

  const updatedTask = await prisma.task.update({
    where: { id },
    data: {
      ...(projectId && { projectId }),
      ...(userId && { userId }),
      ...(title && { title }),
      ...(description && { description }),
      ...(status && { status }),
      ...(priority && { priority }),
      ...(dueDate && { dueDate: new Date(dueDate) }),
    },
  });

  res
    .status(200)
    .json(new ApiResponse(200, "Task updated successfully.", updatedTask));
});

// ========== Delete ==========
export const deleteTask = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existingTask = await prisma.task.findUnique({ where: { id } });
  if (!existingTask) return ApiError.send(res, 404, "Task not found.");

  await prisma.task.delete({ where: { id } });

  res
    .status(200)
    .json(new ApiResponse(200, null, "Task deleted successfully."));
});
