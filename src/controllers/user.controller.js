import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import validator from "validator";
import {
  generateAccessToken,
  generateRefreshToken,
  hashPassword,
  verifyGoogleAccessToken,
} from "../utils/lib.js";
import prisma from "../database/db.config.js";
import { sendOtp } from "../utils/sendOtp.js";

const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const signup = asyncHandler(async (req, res) => {
  let { name, profession, email, mobileNumber, password, googleId, otp } =
    req.body;

  if (!(googleId || (email && password))) {
    throw new ApiError(400, "Google signup or email + password is required.");
  }

  let isGoogleSignUp = false;
  let isEmailVerified = false;
  let passwordHash = null;

  if (googleId) {
    const googleUser = await verifyGoogleAccessToken(googleId);

    if (!googleUser?.emailVerified) {
      throw new ApiError(403, "Google account email not verified.");
    }

    googleId = googleUser.googleId;
    email = googleUser.email;
    name = name || googleUser.name;
    isGoogleSignUp = true;
  } else {
    if (!validator.isEmail(email)) {
      throw new ApiError(400, "Invalid email format.");
    }

    await sendOtp(email, res);

    if (!validator.isStrongPassword(password)) {
      throw new ApiError(
        400,
        "Password must be at least 8 characters long and include letters, numbers, and symbols.",
      );
    }

    passwordHash = await hashPassword(password);
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

  const newUser = await prisma.user.create({
    data: {
      name,
      profession,
      email,
      googleId,
      isGoogleSignUp,
      isEmailVerified,
      mobileNumber,
      passwordHash,
      role: "admin",
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

const login = asyncHandler(async (req, res) => {
  const { email, password, googleId } = req.body;

  if (!(googleId || (email && password))) {
    throw new ApiError(400, "Google login or email + password is required.");
  }

  let user;

  if (googleId) {
    const googleUser = await verifyGoogleToken(googleId);
    if (!googleUser?.emailVerified) {
      throw new ApiError(403, "Google account email not verified.");
    }

    user = await prisma.user.findUnique({
      where: { email: googleUser.email },
    });

    if (!user || !user.isGoogleSignUp) {
      throw new ApiError(404, "No Google account found. Please sign up first.");
    }
  } else {
    if (!validator.isEmail(email)) {
      throw new ApiError(400, "Invalid email format.");
    }

    user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash) {
      throw new ApiError(401, "Invalid credentials.");
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      throw new ApiError(401, "Invalid credentials.");
    }
  }

  const refreshToken = generateRefreshToken(user.id, user.email);
  const accessToken = generateAccessToken(user.id, user.email, user.role);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  });

  const { passwordHash: _, refreshToken: __, ...userSafe } = user;

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(200, "Login successful.", {
        user: userSafe,
        accessToken,
      }),
    );
});

export { signup, login };
