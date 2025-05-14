import nodemailer from "nodemailer";
import validator from "validator";
import prisma from "../database/db.config.js";
import { generateOTP, getExpiry } from "./lib.js";
import { ApiError } from "./ApiError.js";
import { ApiResponse } from "./ApiResponse.js";

// Transporter setup
const transporter = nodemailer.createTransport({
  service: "gmail", // or your SMTP provider
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendOtp = async (email, res) => {
  if (!validator.isEmail(email)) {
    throw new ApiError(400, "Invalid email format.");
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res
      .status(400)
      .json(new ApiResponse(400, "User already exists with this email."));
  }

  const otp = generateOTP();
  const expiresAt = getExpiry();

  await prisma.emailOtp.upsert({
    where: { email },
    update: { otp, expiresAt },
    create: { email, otp, expiresAt },
  });

  await transporter.sendMail({
    from: `"YourApp" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Verify Your Email - OTP Code",
    text: `Your verification code is ${otp}. It will expire in 10 minutes.`,
  });

  return true;
};
