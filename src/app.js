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

import userRouter from "./routes/user.routes.js";
import clientsRouter from "./routes/clients.routes.js";
import proposalsRouter from "./routes/proposals.routes.js";
import tasksRouter from "./routes/tasksRouter.routes.js";
import projectsRouter from "./routes/projects.routes.js";
import paymentRouter from "./routes/payment.routes.js";

// routes declaration
app.use("/api/v1/auth", userRouter);
app.use("/api/v1/client", clientsRouter);
app.use("/api/v1/proposals", proposalsRouter);
app.use("/api/v1/projects", projectsRouter);
app.use("/api/v1/tasks", tasksRouter);
app.use("/api/v1/payments", paymentRouter);

export default app;
