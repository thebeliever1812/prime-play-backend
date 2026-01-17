import mongoose from "mongoose";
import { Notification } from "../models/notification.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export const handleGetAllNotification = async (req, res) => {
    if (!req.user) {
        throw new ApiError(401, "Unauthorized user please login");
    }

    const limitNotifications = req.query.limit
        ? parseInt(req.query.limit)
        : null;

    const notificationPipeline = [
        {
            $match: {
                recipient: new mongoose.Types.ObjectId(req.user._id),
            },
        },
        { $sort: { createdAt: -1 } },
    ];

    if (limitNotifications !== null) {
        notificationPipeline.push({ $limit: limitNotifications + 1 });
    }

    notificationPipeline.push({
        $project: {
            _id: 1,
            sender: 1,
            senderName: 1,
            type: 1,
            message: 1,
            isRead: 1,
            video: 1,
            channel: 1,
            createdAt: 1,
        },
    });

    const notifications = await Notification.aggregate(notificationPipeline);

    let hasMoreNotifications = false;

    if (
        limitNotifications !== null &&
        notifications.length > limitNotifications
    ) {
        hasMoreNotifications = true;
        notifications.pop(); // remove extra record
    }

    res.status(200).json(
        new ApiResponse(200, "Notifications fetched successfully", {
            notifications,
            hasMoreNotifications,
        })
    );
};

export const handleMarkAllNotificationAsRead = async (req, res) => {
    if (!req.user) {
        throw new ApiError(401, "Unauthorized user please login");
    }

    await Notification.updateMany(
        { recipient: req.user._id, isRead: false },
        { $set: { isRead: true } }
    );

    res.status(200).json(
        new ApiResponse(200, "All notifications marked as read successfully")
    );
};

export const handleMarkNotificationAsRead = async (req, res) => {
    if (!req.user) {
        throw new ApiError(401, "Unauthorized user please login");
    }

    const { id } = req.params;

    const notification = await Notification.findOne({
        _id: id,
        recipient: req.user._id,
    });

    if (!notification) {
        throw new ApiError(404, "Notification not found");
    }

    notification.isRead = true;
    await notification.save({ validateBeforeSave: false });

    res.status(200).json(
        new ApiResponse(200, "Notification marked as read successfully")
    );
};

export const handleDeleteNotification = async (req, res) => {
    if (!req.user) {
        throw new ApiError(401, "Unauthorized user please login");
    }

    const { id } = req.params;

    const notification = await Notification.findOneAndDelete({
        _id: id,
        recipient: req.user._id,
    });

    if (!notification) {
        throw new ApiError(404, "Notification not found");
    }

    res.status(200).json(
        new ApiResponse(200, "Notification deleted successfully")
    );
};
