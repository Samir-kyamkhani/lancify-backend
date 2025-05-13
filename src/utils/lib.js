import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { ApiError } from "./ApiError.js";

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

const generateRefreshToken = (id, email) => {
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
