import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import nodemailer from "nodemailer";
import validator from "validator";
import prisma from "../database/db.config.js";

export const hashPassword = async (password) => {
  if (!password) {
    throw new Error("Password is required for hashing.");
  }
  return await bcrypt.hash(password, 10);
};

export const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

export const generateAccessToken = (id, email, role) => {
  return jwt.sign(
    {
      id,
      email,
      role,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    },
  );
};

export const generateRefreshToken = (id, email) => {
  return jwt.sign(
    {
      id,
      email,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    },
  );
};

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const verifyGoogleIdToken = async (idToken) => {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name,
    avatarUrl: payload.picture,
    emailVerified: payload.email_verified,
  };
};

// otp

export function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
}

export function getExpiry(minutes = 10) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendOtp = async (email) => {
  if (!validator.isEmail(email)) throw new Error("Invalid email");

  // const user = await prisma.user.findUnique({ where: { email } });
  // if (!user) throw new Error("User not found.");

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
    subject: "Your OTP Code",
    text: `Your verification code is ${otp}. It expires in 10 minutes.`,
  });
};

export const verifyOtpCode = async (email, otp) => {
  const record = await prisma.emailOtp.findUnique({ where: { email } });
  if (!record || record.otp !== otp || record.expiresAt < new Date()) {
    return false;
  }
  await prisma.emailOtp.deleteMany({ where: { email } });
  return true;
};
