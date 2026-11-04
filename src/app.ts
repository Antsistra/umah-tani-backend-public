import express, { Application } from "express";
import router from "./routes";
import cors from "cors";

const app: Application = express();

// Middleware
app.use(cors());
app.use(express.json());

app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api", router);


export default app;
