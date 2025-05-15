import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import prisma from "../database/db.config.js";

export const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const record = await prisma.emailOtp.findUnique({ where: { email } });

  if (!record || record.otp !== otp) {
    return ApiError.send(res, 400, "Invalid OTP.");
  }

  if (record.expiresAt < new Date()) {
    return ApiError.send(res, 400, "OTP has expired.");
  }

  await prisma.emailOtp.delete({ where: { email } });

  await prisma.user.update({
    where: { email: email },
    data: { isEmailVerified: true },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "OTP verified successfully."));
});
