import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();
const data = "16kb";

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  }),
);

app.use(express.json({ limit: data }));
app.use(express.urlencoded({ extended: true, limit: true }));
app.use(express.static("public"));
app.use(cookieParser());


import userRouter from "./routes/user.routes.js"

// routes declaration
app.use("/api/v1/users", userRouter)


export default app;
