import { Schema, model } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const VideoSchema = new Schema(
    {
        title: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        thumbnail: {
            type: String,
            required: true,
        },
        thumbnailId: {
            type: String,
            required: true,
        },
        videoFile: {
            type: String,
            required: true,
        },
        videoFileId: {
            type: String,
            required: true,
        },
        duration: {
            type: Number, // Cloudinary se info le lege
            required: true,
        },
        views: {
            type: Number,
            default: 0,
        },
        isPublished: {
            type: Boolean,
            default: true,
        },
        viewers: [
            {
                type: Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true }
);

/* TEXT INDEX FOR SEARCH */
VideoSchema.index({
    title: "text",
    description: "text",
});

VideoSchema.plugin(mongooseAggregatePaginate);

export const Video = model("Video", VideoSchema);
