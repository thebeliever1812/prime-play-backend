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
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "videoDetails",
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            title: 1,
                        },
                    },
                ],
            },
        },
        {
            $unwind: {
                path: "$videoDetails",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $project: {
                sender: 1,
                type: 1,
                message: 1,
                isRead: 1,
                videoDetails: 1,
                channel: 1,
                createdAt: 1,
            },
        },
    ]);

    if (notifications.length === 0) {
        throw new ApiError(404, "No notifications found");
    }

    res.status(200).json(
        new ApiResponse(
            200,
            "Notifications fetched successfully",
            notifications
        )
    );
};
