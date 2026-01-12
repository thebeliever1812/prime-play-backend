import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { handleCreateOrder, handleVerifyPayment } from "../controllers/tip.controller.js";

const router = Router();

router.route("/create-order").post(asyncHandler(handleCreateOrder));

router.route("/verify").post(asyncHandler(handleVerifyPayment))

export default router;
