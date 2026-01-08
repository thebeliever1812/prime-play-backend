import crypto from "crypto";
import { razorpay } from "../utils/razorpay.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export const handleCreateOrder = async (req, res) => {
    const { amount } = req.body;

    if (!amount || amount < 1) {
        throw new ApiError(400, "Invalid donation amount");
    }

    const order = await razorpay.orders.create({
        amount: amount * 100, // convert to paise
        currency: "INR",
        receipt: `donation_${Date.now()}`,
        payment_capture: 1,
    });

    return res
        .status(201)
        .json(
            new ApiResponse(201, "Donation order created successfully", order)
        );
};

export const handleVerifyPayment = (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
        req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        throw new ApiError(400, "Missing payment verification fields");
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest("hex");

    if (expectedSignature !== razorpay_signature) {
        throw new ApiError(400, "Payment signature verification failed");
    }

    // ✅ PAYMENT IS VERIFIED
    // TODO: Save donation to DB here (recommended)

    return res.status(200).json(
        new ApiResponse(200, "Payment verified successfully", {
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
        })
    );
};
