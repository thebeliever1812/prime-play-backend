import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { handleGetAllNotification } from "../controllers/notification.controllers.js";

const router = Router();

router.route("/").get(asyncHandler(handleGetAllNotification));

export default router;
