import mongoose from "mongoose";
import { Notification } from "../models/notification.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export const handleGetAllNotification = async (req, res) => {
    if (!req.user) {
        throw new ApiError(401, "Unauthorized user please login");
    }

    const notifications = await Notification.aggregate([
        {
            $match: {
                recipient: new mongoose.Types.ObjectId(req.user._id),
            },
        },
        { $sort: { createdAt: -1 } },
        {
            $project: {
                _id: 1,
                sender: 1,
                type: 1,
                message: 1,
                isRead: 1,
                video: 1,
                channel: 1,
                createdAt: 1,
            },
        },
    ]);

    res.status(200).json(
        new ApiResponse(
            200,
            "Notifications fetched successfully",
            notifications
        )
    );
};
