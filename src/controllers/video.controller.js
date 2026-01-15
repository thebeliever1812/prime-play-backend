import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { VideoUploadSchema } from "../schemas/index.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import mongoose from "mongoose";
import { Like } from "../models/like.model.js";
import { Notification } from "../models/notification.model.js";
import fs from "fs";

export const handleUploadVideo = async (req, res) => {
    if (!req.user) {
        throw new ApiError(401, "Unauthorized, Please login to upload video");
    }

    const { title, description } = req.body;
    const { thumbnail, videoFile } = req.files || {};

    if (!title?.trim() || !description?.trim()) {
        throw new ApiError(400, "Title and description are required");
    }

    if (!thumbnail || !thumbnail.length || !videoFile || !videoFile.length) {
        throw new ApiError(400, "Thumbnail and video file are required");
    }

    const result = VideoUploadSchema.safeParse({
        title,
        description,
        thumbnail: thumbnail[0],
        videoFile: videoFile[0],
    });

    if (!result.success) {
        if (thumbnail?.[0]?.path) {
            fs.unlinkSync(thumbnail[0].path);
        }

        if (videoFile?.[0]?.path) {
            fs.unlinkSync(videoFile[0].path);
        }
        throw new ApiError(
            400,
            result.error.issues.map(
                (err) => `${err.path[0]} ${err.message.toLowerCase()}`
            )
        );
    }

    const validatedData = result.data;

    const thumbnailLocalPath = validatedData.thumbnail.path;
    const videoFileLocalPath = validatedData.videoFile.path;

    if (!thumbnailLocalPath || !videoFileLocalPath) {
        throw new ApiError(
            400,
            "Thumbnail or video file path not found while uploading"
        );
    }

    const thumbnailResponseOnCloudinary =
        await uploadOnCloudinary(thumbnailLocalPath);

    const videoFileResponseOnCloudinary =
        await uploadOnCloudinary(videoFileLocalPath);

    if (!thumbnailResponseOnCloudinary) {
        throw new ApiError(500, "Thumbnail upload failed");
    }

    if (!videoFileResponseOnCloudinary) {
        throw new ApiError(500, "Video upload failed");
    }

    const { public_id: thumbnailPublicId, secure_url: thumbnailSecureUrl } =
        thumbnailResponseOnCloudinary;

    const {
        public_id: videoFilePublicId,
        secure_url: videoFileSecureUrl,
        duration: videoFileDuration,
    } = videoFileResponseOnCloudinary;

    // All fields are ready to add in db

    const video = await Video.create({
        title: validatedData.title,
        description: validatedData.description,
        thumbnail: thumbnailSecureUrl,
        thumbnailId: thumbnailPublicId,
        videoFile: videoFileSecureUrl,
        videoFileId: videoFilePublicId,
        duration: videoFileDuration,
        owner: req.user._id,
    });

    if (!video) {
        throw new ApiError(500, "Failed to create video in database");
    }

    const user = await User.findById(req.user._id);

    if (!user) {
        throw new ApiError(404, "User not found while uploading video");
    }

    user.myVideos.push(video._id);

    await user.save({ validateBeforeSave: false });

    const subscribers = await User.aggregate([
        {
            $match: { _id: new mongoose.Types.ObjectId(req.user._id) },
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers",
                pipeline: [
                    {
                        $project: {
                            _id: 0,
                            subscriber: 1, // only subscriber id
                        },
                    },
                ],
            },
        },
        {
            $project: {
                subscribers: "$subscribers.subscriber",
            },
        },
    ]);

    const subscribersList = subscribers[0]?.subscribers || [];

    const io = req.app.get("io");

    if (subscribersList.length !== 0) {
        const notifications = subscribersList.map((subscriberId) => ({
            recipient: subscriberId,
            sender: user._id,
            type: "NEW_VIDEO",
            message: "New Video uploaded",
            video: video._id,
            channel: user._id,
        }));

        const isNotificationAdded = await Notification.insertMany(notifications)

        if (!isNotificationAdded) {
            throw new ApiError(500, "Failed to add notifications for subscribers");
        }

        // Emit socket event to each subscriber
        subscribersList.forEach((subscriberId) => {
            io.to(subscriberId.toString()).emit("notification:new", {
                type: "NEW_VIDEO",
                message: `${user.fullName} uploaded a new video`,
                videoId: video._id,
                channelId: user._id,
                createdAt: new Date(),
            });
        });
    }

    res.status(201).json(new ApiResponse(201, "Video uploaded successfully"));
};

export const handleGetMyVideos = async (req, res) => {
    if (!req.user) {
        throw new ApiError(
            401,
            "Unauthorized, Please login to view your videos"
        );
    }

    const videos = await Video.aggregate([
        {
            $match: { owner: new mongoose.Types.ObjectId(req.user._id) },
        },
        {
            $sort: { createdAt: -1 },
        },
        {
            $project: {
                title: 1,
                description: 1,
                thumbnail: 1,
                videoFile: 1,
                duration: 1,
                createdAt: 1,
                views: 1,
                owner: 1,
            },
        },
    ]);

    res.status(200).json(
        new ApiResponse(200, "Videos fetched successfully", videos)
    );
};

export const handlePlayVideo = async (req, res) => {
    const { videoId } = req.params;

    if (!videoId) {
        throw new ApiError(400, "Video ID is required");
    }

    if (req.user) {
        const userId = req.user._id;
        const videoObjectId = new mongoose.Types.ObjectId(videoId); // 🔥 FIX

        // 1️⃣ remove old entry
        await User.updateOne(
            { _id: userId },
            { $pull: { watchHistory: { video: videoObjectId } } } // 🔥 FIX
        );

        // 2️⃣ push to top
        await User.updateOne(
            { _id: userId },
            {
                $push: {
                    watchHistory: {
                        $each: [
                            { video: videoObjectId, watchedAt: new Date() },
                        ], // 🔥 FIX
                        $position: 0,
                    },
                },
            }
        );

        // views logic (unchanged)
        const videoDetails = await Video.findById(videoObjectId);

        if (!videoDetails) {
            throw new ApiError(404, "Video not found");
        }

        const isAlreadyViewed = videoDetails.viewers.some((id) =>
            id.equals(userId)
        );

        if (!isAlreadyViewed) {
            videoDetails.viewers.push(userId);
            videoDetails.views += 1;
            await videoDetails.save({ validateBeforeSave: false });
        }
    }

    const video = await Video.aggregate([
        {
            $match: { _id: new mongoose.Types.ObjectId(videoId) },
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
            },
        },
        {
            $unwind: "$owner",
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "owner._id",
                foreignField: "channel",
                as: "subscribers",
            },
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes",
            },
        },
        {
            $addFields: {
                "owner.subscribersCount": { $size: "$subscribers" },
                likesCount: { $size: "$likes" },
                isLiked: {
                    $cond: {
                        if: {
                            $in: [
                                new mongoose.Types.ObjectId(req.user?._id),
                                "$likes.likedBy",
                            ],
                        },
                        then: true,
                        else: false,
                    },
                },
            },
        },
        {
            $project: {
                title: 1,
                description: 1,
                videoFile: 1,
                duration: 1,
                createdAt: 1,
                views: 1,
                owner: {
                    _id: 1,
                    username: 1,
                    fullName: 1,
                    avatar: 1,
                    subscribersCount: 1,
                },
                likesCount: 1,
                isLiked: 1,
            },
        },
    ]);

    if (!video || video.length === 0) {
        throw new ApiError(404, "Video not found");
    }

    res.status(200).json(
        new ApiResponse(200, "Video fetched successfully", video[0])
    );
};

export const handleGetAllVideos = async (req, res) => {
    const limit = parseInt(req.query.limit) || 6;
    const cursor = req.query.cursor;
    const search = req.query.search?.trim();

    const matchStage = {};

    if (search) {
        matchStage.$text = { $search: search };
    }

    if (cursor) {
        matchStage.createdAt = { $lt: new Date(cursor) };
    }

    const pipeline = [
        { $match: matchStage },

        ...(search
            ? [
                  {
                      $addFields: {
                          score: { $meta: "textScore" },
                      },
                  },
                  {
                      $sort: {
                          score: -1, // relevance
                          createdAt: -1, // tie-breaker
                      },
                  },
              ]
            : [
                  {
                      $sort: {
                          createdAt: -1,
                      },
                  },
              ]),

        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerInfo",
            },
        },

        { $unwind: "$ownerInfo" },

        { $limit: limit + 1 },

        {
            $project: {
                title: 1,
                description: 1,
                thumbnail: 1,
                duration: 1,
                createdAt: 1,
                views: 1,
                ownerInfo: {
                    _id: 1,
                    username: 1,
                    fullName: 1,
                    avatar: 1,
                },
            },
        },
    ];

    const videos = await Video.aggregate(pipeline);

    if (videos.length === 0) {
        return res.status(200).json(
            new ApiResponse(200, "No more videos", {
                videos: [],
                nextCursor: null,
            })
        );
    }

    let nextCursor = null;

    if (videos.length > limit) {
        videos.pop();
        nextCursor = videos[videos.length - 1].createdAt;
    }

    res.status(200).json(
        new ApiResponse(200, "Videos fetched successfully", {
            videos,
            nextCursor,
        })
    );
};

export const handleGetChannelVideos = async (req, res) => {
    const { username } = req.params;

    if (!username) {
        throw new ApiError(400, "Username is required");
    }
    const user = await User.findOne({ username });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const videos = await Video.aggregate([
        {
            $match: { owner: new mongoose.Types.ObjectId(user._id) },
        },
        {
            $sort: { createdAt: -1 },
        },
        {
            $project: {
                title: 1,
                description: 1,
                thumbnail: 1,
                videoFile: 1,
                duration: 1,
                createdAt: 1,
                views: 1,
            },
        },
    ]);

    res.status(200).json(
        new ApiResponse(200, "Videos fetched successfully", videos)
    );
};

export const handleGetLikedVideos = async (req, res) => {
    if (!req.user) {
        throw new ApiError(
            401,
            "Unauthorized, Please login to view liked videos"
        );
    }

    const userId = req.user._id;

    if (!userId) {
        throw new ApiError(400, "User ID is required");
    }

    const likedVideos = await Like.aggregate([
        {
            $match: {
                likedBy: new mongoose.Types.ObjectId(userId),
            },
        },
        {
            $sort: {
                createdAt: -1,
            },
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "likedVideo",
            },
        },
        {
            $unwind: "$likedVideo",
        },
        {
            $project: {
                createdAt: 1,
                likedVideo: {
                    _id: 1,
                    title: 1,
                    description: 1,
                    thumbnail: 1,
                    views: 1,
                    createdAt: 1,
                },
            },
        },
    ]);

    if (likedVideos.length === 0) {
        throw new ApiError(404, "No liked videos found");
    }

    res.status(200).json(
        new ApiResponse(200, "Liked videos fetched successfully", likedVideos)
    );
};

export const handleDeleteVideo = async (req, res) => {
    if (!req.user) {
        throw new ApiError(401, "Unauthorized, Please login to delete video");
    }

    const { videoId } = req.params;

    if (!videoId) {
        throw new ApiError(400, "Video ID is required");
    }

    const user = await User.findById(req.user._id);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    user.myVideos = user.myVideos.filter((id) => id.toString() !== videoId);

    await user.save({ validateBeforeSave: false });

    await Video.findByIdAndDelete(videoId);

    res.status(200).json(new ApiResponse(200, "Video deleted successfully"));
};
