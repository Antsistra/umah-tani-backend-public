import { Request, Response } from "express";
import { catchAsync } from "../utils/appError";


export const healthCheck = catchAsync(async (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Umah Tani API is running successfully",
    data: {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      version: "1.0.0",
    },
  });
});