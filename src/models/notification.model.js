import { Schema, model } from "mongoose";

const notificationSchema = new Schema(
    {
        // User who will RECEIVE the notification
        recipient: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        // User who TRIGGERED the notification (creator)
        sender: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        type: {
            type: String,
            enum: ["NEW_VIDEO", "COMMENT", "LIKE", "SUBSCRIBE", "TIP"],
            required: true,
        },

        message: {
            type: String,
            required: true,
            trim: true,
        },

        // Optional references (based on type)
        video: {
            type: Schema.Types.ObjectId,
            ref: "Video",
            default: null,
        },

        comment: {
            type: Schema.Types.ObjectId,
            ref: "Comment",
            default: null,
        },

        // Channel / creator involved
        channel: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        isRead: {
            type: Boolean,
            default: false,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

// Compound index for fast notification fetch
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export const Notification = model("Notification", notificationSchema);

