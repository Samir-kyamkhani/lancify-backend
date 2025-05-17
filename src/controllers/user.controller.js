import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import validator from "validator";
import {
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  hashPassword,
  verifyGoogleIdToken,
} from "../utils/lib.js";
import prisma from "../database/db.config.js";
import { sendOtp, verifyOtpCode } from "../utils/lib.js";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const signup = asyncHandler(async (req, res) => {
  let { name, profession, email, mobileNumber, password, googleId, otp } =
    req.body;

  if (!(googleId || (email && password))) {
    return ApiError.send(
      res,
      400,
      "Google sign-up or email + password is required.",
    );
  }

  let isGoogleSignUp = false;
  let isEmailVerified = false;
  let passwordHash = null;

  if (googleId) {
    const googleUser = await verifyGoogleIdToken(googleId);
    if (!googleUser?.emailVerified) {
      return ApiError.send(res, 403, "Google account email not verified.");
    }
    googleId = googleUser.googleId;
    email = googleUser.email;
    name = name || googleUser.name;
    isGoogleSignUp = true;
  } else {
    if (!validator.isEmail(email)) {
      return ApiError.send(res, 400, "Invalid email format.");
    }
    if (!otp) {
      await sendOtp(email);
      return res
        .status(200)
        .json(new ApiResponse(200, "OTP sent to your email."));
    }
    const otpVerified = await verifyOtpCode(email, otp);
    if (!otpVerified) {
      return ApiError.send(res, 400, "Invalid or expired OTP.");
    }
    isEmailVerified = true;

    if (!validator.isStrongPassword(password)) {
      return ApiError.send(
        res,
        400,
        "Password must be at least 8 characters long and include letters, numbers, and symbols.",
      );
    }
    passwordHash = await hashPassword(password);
  }

  if (mobileNumber && !validator.isMobilePhone(mobileNumber, "any")) {
    return ApiError.send(res, 400, "Invalid mobile number.");
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
    return ApiError.send(
      res,
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
    return ApiError.send(
      res,
      400,
      "Google login or email + password is required.",
    );
  }

  let user;

  if (googleId) {
    const googleUser = await verifyGoogleIdToken(googleId);
    if (!googleUser?.emailVerified) {
      return ApiError.send(res, 403, "Google account email not verified.");
    }
    user = await prisma.user.findUnique({ where: { email: googleUser.email } });

    if (!user || !user.isGoogleSignUp) {
      return ApiError.send(
        res,
        404,
        "Google account not registered. Please sign up first.",
      );
    }
  } else {
    if (!validator.isEmail(email)) {
      return ApiError.send(res, 400, "Invalid email format.");
    }
    user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await comparePassword(password, user.passwordHash))) {
      return ApiError.send(res, 401, "Invalid credentials.");
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

const forgotPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!validator.isEmail(email)) {
    return ApiError.send(res, 400, "Valid email is required.");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return ApiError.send(res, 404, "User not found.");
  }

  if (!otp && !newPassword) {
    await sendOtp(email);
    return res
      .status(200)
      .json(new ApiResponse(200, "OTP has been sent to your email."));
  }

  if (otp && newPassword) {
    if (!validator.isStrongPassword(newPassword)) {
      return ApiError.send(
        res,
        400,
        "Password must be at least 8 characters long and include letters, numbers, and symbols.",
      );
    }

    const otpVerified = await verifyOtpCode(email, otp);
    if (!otpVerified) {
      return ApiError.send(res, 400, "Invalid or expired OTP.");
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { email },
      data: { passwordHash: hashedPassword },
    });

    return res
      .status(200)
      .json(new ApiResponse(200, "Password reset successful."));
  }

  return ApiError.send(res, 400, "Invalid request.");
});

const resendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!validator.isEmail(email)) {
    return ApiError.send(res, 400, "Invalid email format.");
  }

  await sendOtp(email);

  return res.status(200).json(new ApiResponse(200, "OTP resent successfully."));
});

const resetPassword = asyncHandler(async (req, res) => {
  const userId = req.user?.id; // From auth middleware
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return ApiError.send(res, 400, "Current and new passwords are required.");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return ApiError.send(res, 404, "User not found.");
  }

  const isPasswordValid = await comparePassword(
    currentPassword,
    user.passwordHash,
  );
  if (!isPasswordValid) {
    return ApiError.send(res, 401, "Current password is incorrect.");
  }

  if (!newPassword || newPassword === currentPassword) {
    return ApiError.send(res, 400, "New password must be different.");
  }

  const isStrong = newPassword.length >= 8;
  if (!isStrong) {
    return ApiError.send(res, 400, "New password is too weak.");
  }

  const hashedNewPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hashedNewPassword,
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Password changed successfully."));
});

export { signup, login, forgotPassword, resendOtp, resetPassword };
