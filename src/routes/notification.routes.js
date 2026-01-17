import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
    handleGetAllNotification,
    handleMarkAllNotificationAsRead,
    handleMarkNotificationAsRead,
    handleDeleteNotification,
} from "../controllers/notification.controllers.js";

const router = Router();

router.route("/").get(asyncHandler(handleGetAllNotification));

router.route("/read-all").patch(asyncHandler(handleMarkAllNotificationAsRead));

router.route("/:id/read").patch(asyncHandler(handleMarkNotificationAsRead));

router.route("/:id").delete(asyncHandler(handleDeleteNotification));

export default router;
