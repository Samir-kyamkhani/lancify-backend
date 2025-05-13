import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import validator from "validator";
import {
  generateAccessToken,
  generateRefreshToken,
  hashPassword,
} from "../utils/lib.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import prisma from "../database/db.config.js";

const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const signup = asyncHandler(async (req, res) => {
  const {
    name,
    profession,
    companyName,
    email,
    mobileNumber,
    password,
    googleId,
    adminAddress,
  } = req.body;

  if (!email || (!password && !googleId)) {
    throw new ApiError(400, "Email and password or Google ID are required.");
  }

  if (!validator.isEmail(email)) {
    throw new ApiError(400, "Invalid email format.");
  }

  if (mobileNumber && !validator.isMobilePhone(mobileNumber, "any")) {
    throw new ApiError(400, "Invalid mobile number.");
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        ...(googleId ? [{ googleId }] : []),
        ...(mobileNumber ? [{ mobileNumber }] : []),
      ],
    },
  });

  if (existingUser) {
    throw new ApiError(
      400,
      "User already exists with the given email, mobile number, or Google ID.",
    );
  }

  let passwordHash = null;
  let isGoogleSignUp = false;
  let isEmailVerified = false;

  if (googleId) {
    isGoogleSignUp = true;
    isEmailVerified = true;
  } else {
    if (!validator.isStrongPassword(password)) {
      throw new ApiError(
        400,
        "Password must be at least 8 characters long and include letters, numbers, and symbols.",
      );
    }
    passwordHash = await hashPassword(password);
  }

  const avatarLocalPath = req.files?.avatarUrl?.[0]?.path;
  let avatarUrl = null;
  if (avatarLocalPath) {
    const uploadResult = await uploadOnCloudinary(avatarLocalPath);
    avatarUrl = uploadResult?.secure_url || null;
  }

  const newUser = await prisma.user.create({
    data: {
      name,
      profession,
      companyName,
      email,
      googleId,
      isGoogleSignUp,
      isEmailVerified,
      mobileNumber,
      passwordHash,
      role: "admin",
      avatarUrl,
      adminAddress,
      refreshToken: "",
    },
  });

  if (!newUser) {
    throw new ApiError(500, "User could not be created.");
  }

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

  return res
    .status(201)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(201, "Admin created successfully.", {
        user: userSafe,
        accessToken,
      }),
    );
});

export { signup };
