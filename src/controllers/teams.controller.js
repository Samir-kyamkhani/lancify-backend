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
