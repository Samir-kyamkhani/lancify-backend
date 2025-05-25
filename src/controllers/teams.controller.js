import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import validator from "validator";
import {
  generateAccessToken,
  generateRefreshToken,
  hashPassword,
} from "../utils/lib.js";
import prisma from "../database/db.config.js";

const ALLOWED_ROLES = ["user", "member"];
const ALLOWED_STATUSES = ["active", "inactive"];

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// Create Member
export const memberSignup = asyncHandler(async (req, res) => {
  let { name, email, password, role, status, permissions } = req.body;

  name = typeof name === "string" ? name.trim() : "";
  email = typeof email === "string" ? email.toLowerCase().trim() : "";
  password = typeof password === "string" ? password : "";
  role = typeof role === "string" ? role.toLowerCase().trim() : "";
  status = typeof status === "string" ? status.toLowerCase().trim() : "";
  permissions = Array.isArray(permissions) ? permissions : [];

  if (!name || !email || !password || !role || !status) {
    return ApiError.send(res, 400, "All fields are required.");
  }

  if (!validator.isEmail(email)) {
    return ApiError.send(res, 400, "Invalid email format.");
  }

  if (
    !validator.isStrongPassword(password, {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    })
  ) {
    return ApiError.send(res, 400, "Password must be strong.");
  }

  if (!ALLOWED_ROLES.includes(role)) {
    return ApiError.send(res, 400, "Invalid role specified.");
  }

  if (!ALLOWED_STATUSES.includes(status)) {
    return ApiError.send(res, 400, "Invalid status specified.");
  }

  // Validate permissions only if role is member
  let permissionRecords = [];
  if (role === "member") {
    if (
      !Array.isArray(permissions) ||
      !permissions.every((p) => typeof p === "string")
    ) {
      return ApiError.send(
        res,
        400,
        "Permissions must be an array of strings.",
      );
    }

    permissionRecords = await prisma.permission.findMany({
      where: {
        name: { in: permissions },
      },
    });

    if (permissionRecords.length !== permissions.length) {
      return ApiError.send(res, 400, "Some permissions are invalid.");
    }
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return ApiError.send(res, 400, "User already exists with this email.");
  }

  const passwordHash = await hashPassword(password);

  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      status,
      isEmailVerified: true,
      refreshToken: "",
      ...(role === "member" &&
        permissionRecords.length > 0 && {
          permissions: {
            create: permissionRecords.map((perm) => ({
              permission: {
                connect: { id: perm.id },
              },
            })),
          },
        }),
    },
    include: {
      permissions: {
        include: { permission: true },
      },
    },
  });

  const refreshToken = generateRefreshToken(newUser.id, newUser.email);
  const accessToken = generateAccessToken(
    newUser.id,
    newUser.email,
    newUser.role,
  );

  await prisma.user.update({
    where: { id: newUser.id },
    data: { refreshToken },
  });

  const { passwordHash: _, refreshToken: __, ...userSafe } = newUser;
  const userPermissions = newUser.permissions.map((p) => p.permission.name);

  return res
    .status(201)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(201, `${role} created successfully.`, {
        user: userSafe,
        accessToken,
        permissions: userPermissions,
      }),
    );
});

// Update Member
export const updateMember = asyncHandler(async (req, res) => {
  const { id } = req.params;
  let { name, status, permissions } = req.body;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== "member") {
    return ApiError.send(res, 404, "Member not found.");
  }

  if (status && !ALLOWED_STATUSES.includes(status)) {
    return ApiError.send(res, 400, "Invalid status specified.");
  }

  let permissionRecords = [];
  if (permissions) {
    if (
      !Array.isArray(permissions) ||
      !permissions.every((p) => typeof p === "string")
    ) {
      return ApiError.send(
        res,
        400,
        "Permissions must be an array of strings.",
      );
    }

    permissionRecords = await prisma.permission.findMany({
      where: { name: { in: permissions } },
    });

    if (permissionRecords.length !== permissions.length) {
      return ApiError.send(res, 400, "Some permissions are invalid.");
    }
  }

  await prisma.user.update({
    where: { id },
    data: {
      name,
      status,
      ...(permissionRecords.length && {
        permissions: {
          deleteMany: {}, // Remove old permissions
          create: permissionRecords.map((perm) => ({
            permission: { connect: { id: perm.id } },
          })),
        },
      }),
    },
  });

  const updatedUser = await prisma.user.findUnique({
    where: { id },
    include: {
      permissions: {
        include: { permission: true },
      },
    },
  });

  const { passwordHash, refreshToken, ...userSafe } = updatedUser;
  const updatedPermissions = updatedUser.permissions.map(
    (p) => p.permission.name,
  );

  return res.status(200).json(
    new ApiResponse(200, "Member updated successfully.", {
      ...userSafe,
      permissions: updatedPermissions,
    }),
  );
});

// Delete Member
export const deleteMember = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== "member") {
    return ApiError.send(res, 404, "Member not found.");
  }

  await prisma.user.delete({ where: { id } });

  return res
    .status(200)
    .json(new ApiResponse(200, "Member deleted successfully."));
});

// Get Single Member
export const getSingleMember = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      permissions: {
        include: { permission: true },
      },
    },
  });

  if (!user || user.role !== "member") {
    return ApiError.send(res, 404, "Member not found.");
  }

  const { passwordHash, refreshToken, ...userSafe } = user;
  const permissions = user.permissions.map((p) => p.permission.name);

  return res.status(200).json(
    new ApiResponse(200, "Member fetched successfully.", {
      ...userSafe,
      permissions,
    }),
  );
});

// Get All Members
export const getAllMembers = asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    where: { role: "member" },
    include: {
      permissions: {
        include: { permission: true },
      },
    },
  });

  const formattedUsers = users.map((user) => {
    const { passwordHash, refreshToken, ...userSafe } = user;
    const permissions = user.permissions.map((p) => p.permission.name);
    return { ...userSafe, permissions };
  });

  return res
    .status(200)
    .json(
      new ApiResponse(200, "Members fetched successfully.", formattedUsers),
    );
});

// Get All Users
export const getAllUsers = asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    where: { role: "user" },
    include: {
      permissions: {
        include: { permission: true },
      },
    },
  });

  const formattedUsers = users.map((user) => {
    const { passwordHash, refreshToken, ...userSafe } = user;
    const permissions = user.permissions.map((p) => p.permission.name);
    return { ...userSafe, permissions };
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Users fetched successfully.", formattedUsers));
});

export const getAllPermissions = asyncHandler(async (req, res) => {
  const permissions = await prisma.permission.findMany();
  return res
    .status(200)
    .json(
      new ApiResponse(200, "Permissions fetched successfully.", permissions),
    );
});
