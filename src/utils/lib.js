import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { ApiError } from "./ApiError.js";
import { OAuth2Client } from "google-auth-library";

export const hashPassword = async (password) => {
  if (!password) {
    throw new Error("Password is required for hashing.");
  }
  return await bcrypt.hash(password, 10);
};

export const comparePassword = async (password, hashedPassword) => {
  const isMatch = await bcrypt.compare(password, hashedPassword);

  if (!isMatch) {
    throw new ApiError(401, "Invalid password");
  }

  return isMatch;
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

export const verifyGoogleToken = async (token) => {
  const ticket = await client.verifyIdToken({
    idToken: token,
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

// utils/otp.js
export function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
}

export function getExpiry(minutes = 10) {
  return new Date(Date.now() + minutes * 60 * 1000);
}