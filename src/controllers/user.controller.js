import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
    UserRegisterSchema,
    UserLoginSchema,
    UserPasswordSchema,
    UsernameSchema,
} from "../schemas/index.js";
import { User, UserSchema } from "../models/user.model.js";
import {
    deleteImageFileFromCloudinary,
    uploadOnCloudinary,
} from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Like } from "../models/like.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Video } from "../models/video.model.js";

const generateAccessAndRefreshTokens = async (userId) => {
    if (!userId) {
        return null;
    }
    try {
        const user = await User.findById(userId).select("-password");

        if (!user) {
            return null;
        }

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;

        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken, user };
    } catch (error) {
        throw new ApiError(500, "Failed to generate tokens");
    }
};

export const handleRegisterUser = async (req, res) => {
    if (req.user) {
        throw new ApiError(400, "You are already a logged in user");
    }

    const { username, fullName, email, password } = req.body;

    if (
        [username, fullName, email, password].some(
            (field) => !field || field?.trim() === ""
        )
    ) {
        throw new ApiError(400, "All fields are required");
    }

    // Validation
    const result = UserRegisterSchema.safeParse({
        username,
        fullName,
        email,
        password,
    });

    if (!result.success) {
        throw new ApiError(
            400,
            result.error.issues
                .map((err) => `${err.path[0]} ${err.message.toLowerCase()}`)
                .join(", ")
        );
    }

    // If reached here that means validation is successful
    const validatedData = result.data;

    // Check for existing user
    const isExistingUser = await User.findOne({
        $or: [
            { username: validatedData.username },
            { email: validatedData.email },
        ],
    });

    if (isExistingUser) {
        throw new ApiError(409, "Email or username already exist");
    }

    const { avatar, coverImage } = req.files || {};

    const avatarLocalFilePath = avatar?.[0]?.path;
    const coverImageLocalFilePath = coverImage?.[0]?.path;

    let avatarUrl;
    let avatarImageId;
    let coverImageUrl;
    let coverImageId;

    if (avatarLocalFilePath) {
        const avatarResponse = await uploadOnCloudinary(avatarLocalFilePath);
        avatarUrl = avatarResponse.secure_url;
        avatarImageId = avatarResponse.public_id;
    }

    if (coverImageLocalFilePath) {
        const coverImageResponse = await uploadOnCloudinary(
            coverImageLocalFilePath
        );
        coverImageUrl = coverImageResponse.secure_url;
        coverImageId = coverImageResponse.public_id;
    }

    // Create user account
    const newUser = await User.create({
        ...validatedData,
        avatar: avatarUrl,
        avatarImageId,
        coverImage: coverImageUrl,
        coverImageId,
    });

    if (!newUser) {
        throw new ApiError(500, "Failed to create account");
    }

    res.status(201).json(new ApiResponse(201, "Account created successfully"));
};

export const handleLoginUser = async (req, res) => {
    if (req.user) {
        throw new ApiError(400, "You are already a logged in user");
    }

    const { email, password } = req.body;

    if ([email, password].some((field) => !field || field.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    // Validation
    const result = UserLoginSchema.safeParse({ email, password });

    if (!result.success) {
        throw new ApiError(
            400,
            result.error.issues
                .map((err) => `${err.path[0]} ${err.message.toLowerCase()}`)
                .join(", ")
        );
    }

    const validatedData = result.data;

    // First check if user exist or not
    const user = await User.findOne({ email });

    if (!user) {
        throw new ApiError(404, "Account does not exist with this email");
    }

    const isPasswordMatching = await user.matchPassword(validatedData.password);

    if (!isPasswordMatching) {
        throw new ApiError(401, "Incorrect password, try again!");
    }

    const tokensAndUpdatedUser = await generateAccessAndRefreshTokens(user._id);

    if (!tokensAndUpdatedUser) {
        throw new ApiError("Failed to generate tokens, please login again!");
    }

    const { accessToken, refreshToken } = tokensAndUpdatedUser;

    return res
        .status(200)
        .cookie("accessToken", accessToken, global.accessTokenCookieOptions)
        .cookie("refreshToken", refreshToken, global.refreshTokenCookieOptions)
        .json(new ApiResponse(200, "Login successful"));
};

export const handleLogoutUser = async (req, res) => {
    if (!req.user) {
        throw new ApiError(401, "Unauthorized user, please login");
    }

    await User.updateOne(
        { _id: req.user._id },
        { $unset: { refreshToken: "" } }
    );

    res.status(200)
        .clearCookie("accessToken", global.accessTokenCookieOptions)
        .clearCookie("refreshToken", global.refreshTokenCookieOptions)
        .json(new ApiResponse(200, "Logout Successfull"));
};

export const refreshAccessToken = async (req, res) => {
    if (req.user) {
        throw new ApiError(401, "Access token not expired");
    }

    const currentRefreshToken =
        req.cookies.refreshToken || req.body.refreshToken;

    if (!currentRefreshToken) {
        throw new ApiError(404, "Refresh token not found, please login again");
    }

    try {
        const isVerifiedRefreshToken = jwt.verify(
            currentRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const userId = isVerifiedRefreshToken._id;

        const user = await User.findById(userId);

        if (!user) {
            throw new ApiError(404, "User not found for this refresh token");
        }

        if (currentRefreshToken !== user?.refreshToken) {
            throw new ApiError(
                401,
                "Unauthorized: Refresh token does not match"
            );
        }

        const { accessToken, refreshToken: newRefreshToken } =
            await generateAccessAndRefreshTokens(user._id);

        res.status(200)
            .cookie("accessToken", accessToken, global.accessTokenCookieOptions)
            .cookie(
                "refreshToken",
                newRefreshToken,
                global.refreshTokenCookieOptions
            )
            .json(new ApiResponse(200, "Access token updated"));
    } catch (error) {
        if (error instanceof ApiError) {
            throw new ApiError(error.statusCode, error.message);
        }
        throw new ApiError(401, "Invalid or expired token");
    }
};

export const handleChangePassword = async (req, res) => {
    if (!req.user) {
        throw new ApiError(
            401,
            "You are not logged in, please login to change the password"
        );
    }

    const { oldPassword, newPassword } = req.body;

    if (
        [oldPassword, newPassword].some(
            (field) => !field || field?.trim() === ""
        )
    ) {
        throw new ApiError(400, "All fields are required");
    }

    const oldPasswordResult = UserPasswordSchema.safeParse({
        password: oldPassword,
    });

    if (!oldPasswordResult.success) {
        throw new ApiError(
            400,
            `Old password ${oldPasswordResult.error?.issues[0]?.message.toLowerCase()}`
        );
    }

    const newPasswordResult = UserPasswordSchema.safeParse({
        password: newPassword,
    });

    if (!newPasswordResult.success) {
        throw new ApiError(
            400,
            `New password ${newPasswordResult.error?.issues[0]?.message.toLowerCase()}`
        );
    }

    const validatedOldPassword = oldPasswordResult.data.password;
    const validatedNewPassword = newPasswordResult.data.password;

    // Check for correct password from database
    const user = await User.findById(req.user?._id);

    if (!user) {
        throw new ApiError(404, "User not found while changing password");
    }

    const isPasswordMatched = await user.matchPassword(validatedOldPassword);

    if (!isPasswordMatched) {
        throw new ApiError(400, "Incorrect old password");
    }

    user.password = validatedNewPassword;

    await user.save({ validateBeforeSave: false });

    res.status(201).json(new ApiResponse(201, "Password changed successfully"));
};

export const handleGetCurrentUser = async (req, res) => {
    if (!req.user) {
        throw new ApiError(
            401,
            "Unauthorized, please login to get your details"
        );
    }

    const user = await User.findById(req.user?._id).select(
        "-password -refreshToken"
    );

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    res.status(200).json(new ApiResponse(200, "User details found", user));
};

export const handleUpdateAvatar = async (req, res) => {
    if (!req.user) {
        throw new ApiError(401, "Unauthorized, Please login to update avatar");
    }

    const newAvatar = req.file;

    if (!newAvatar) {
        throw new ApiError(400, "Avatar file needed");
    }

    const newAvatarLocalFilePath = newAvatar?.path;

    if (!newAvatarLocalFilePath) {
        throw new ApiError(400, "Avatar file path not found");
    }

    const user = await User.findById(req.user?._id);

    if (!user) {
        throw new ApiError(
            404,
            "User not found when deleting old avatar image"
        );
    }

    const oldAvatarImageId = user?.avatarImageId;

    if (oldAvatarImageId) {
        const isDeletedAvatar =
            await deleteImageFileFromCloudinary(oldAvatarImageId);
        if (isDeletedAvatar.result !== "ok") {
            throw new ApiError(400, "Failed to delete old avatar image");
        }
    }

    const result = await uploadOnCloudinary(newAvatarLocalFilePath);

    if (!result) {
        throw new ApiError(500, "Upload failed, please try again");
    }

    const newAvatarUrl = result?.secure_url;
    const newAvatarImageId = result?.public_id;

    await User.findByIdAndUpdate(req.user?._id, {
        $set: { avatar: newAvatarUrl, avatarImageId: newAvatarImageId },
    });

    res.status(201).json(new ApiResponse(201, "Avatar updated successfully"));
};

export const handleDeleteAvatar = async (req, res) => {
    if (!req.user) {
        throw new ApiError(401, "Unauthorized, please login to delete avatar");
    }

    const user = await User.findById(req.user?._id).select(
        "-password -refreshToken"
    );

    if (!user) {
        throw new ApiError(404, "User not found while deleting avatar");
    }

    const avatarImageId = user?.avatarImageId;

    if (!avatarImageId) {
        throw new ApiError(400, "User has no avatar to delete");
    }

    const isDeletedAvatar = await deleteImageFileFromCloudinary(avatarImageId);

    if (isDeletedAvatar.result !== "ok") {
        throw new ApiError(500, "Failed to delete the avatar");
    }

    const defaultAvatar = UserSchema.path("avatar").options.default;

    await User.updateOne(
        { _id: user?._id },
        { $set: { avatarImageId: null, avatar: defaultAvatar } }
    );

    res.status(200).json(new ApiResponse(200, "Avatar deleted successfully"));
};

export const handleUpdateCoverImage = async (req, res) => {
    if (!req.user) {
        throw new ApiError(
            401,
            "Unauthorized, Please login to update cover image"
        );
    }

    const newCoverImage = req.file;

    if (!newCoverImage) {
        throw new ApiError(400, "Cover image required");
    }

    const newCoverImageLocalFilePath = newCoverImage?.path;

    if (!newCoverImageLocalFilePath) {
        throw new ApiError(400, "Cover image file path not found");
    }

    const user = await User.findById(req.user?._id);

    if (!user) {
        throw new ApiError(
            404,
            "User not found while deleting old cover image"
        );
    }

    const oldCoverImageId = user?.coverImageId;

    if (oldCoverImageId) {
        const isDeletedCoverImage =
            await deleteImageFileFromCloudinary(oldCoverImageId);

        if (isDeletedCoverImage.result !== "ok") {
            throw new ApiError(400, "Failed to delete old cover image");
        }
    }

    const result = await uploadOnCloudinary(newCoverImageLocalFilePath);

    if (!result) {
        throw new ApiError(500, "Upload failed, please try again");
    }

    const newCoverImageUrl = result?.secure_url;
    const newCoverImageId = result?.public_id;

    await User.findByIdAndUpdate(req.user?._id, {
        $set: { coverImage: newCoverImageUrl, coverImageId: newCoverImageId },
    });

    res.status(201).json(
        new ApiResponse(201, "Cover image updated successfully")
    );
};

export const handleDeleteCoverImage = async (req, res) => {
    if (!req.user) {
        throw new ApiError(
            401,
            "Unauthorized, please login to delete cover image"
        );
    }

    const user = await User.findById(req.user?._id).select(
        "-password -refreshToken"
    );

    if (!user) {
        throw new ApiError(404, "User not found while deleting cover image");
    }

    const coverImageId = user?.coverImageId;

    if (!coverImageId) {
        throw new ApiError(400, "User has no cover image to delete");
    }

    const isDeletedCoverImage =
        await deleteImageFileFromCloudinary(coverImageId);

    if (isDeletedCoverImage.result !== "ok") {
        throw new ApiError(500, "Failed to delete the cover image");
    }

    const defaultCoverImage = UserSchema.path("coverImage").options.default;

    await User.updateOne(
        { _id: user?._id },
        { $set: { coverImageId: null, coverImage: defaultCoverImage } }
    );

    res.status(200).json(
        new ApiResponse(200, "Cover image deleted successfully")
    );
};

export const handleGetUserChannelProfile = async (req, res) => {
    const { username } = req.params;

    if (!username?.trim()) {
        throw new ApiError(400, "Username is missing");
    }

    const result = UsernameSchema.safeParse({ username });

    if (!result.success) {
        throw new ApiError(400, `Username ${result.error.issues[0]?.message}`);
    }

    const validatedUsername = result.data.username;

    const channel = await User.aggregate([
        {
            $match: {
                username: validatedUsername,
            },
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers",
            },
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo",
            },
        },
        {
            $addFields: {
                subscribersCount: { $size: "$subscribers" },
                channelsSubscribedToCount: { $size: "$subscribedTo" },
                videosCount: { $size: "$myVideos" },
                isSubscribed: {
                    $cond: {
                        if: {
                            $in: [
                                new mongoose.Types.ObjectId(req.user?._id),
                                "$subscribers.subscriber",
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
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1,
                videosCount: 1,
            },
        },
    ]);

    if (!channel?.length) {
        throw new ApiError(404, "Channel does not exists");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                "User channel fetched successfully",
                channel[0]
            )
        );
};

export const handleWatchHistory = async (req, res) => {
    if (!req.user) {
        throw new ApiError(
            401,
            "Unauthorized, please login to get watch history"
        );
    }

    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(String(req.user._id)),
            },
        },

        // 1️⃣ break array but keep order
        { $unwind: "$watchHistory" },

        // 2️⃣ lookup each video
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory.video",
                foreignField: "_id",
                as: "video",
            },
        },

        { $unwind: "$video" },

        // 3️⃣ populate owner
        {
            $lookup: {
                from: "users",
                localField: "video.owner",
                foreignField: "_id",
                as: "video.owner",
            },
        },
        {
            $addFields: {
                "video.owner": { $first: "$video.owner" },
                "video.watchedAt": "$watchHistory.watchedAt",
            },
        },

        // 4️⃣ restore original array order
        {
            $group: {
                _id: "$_id",
                watchHistory: { $push: "$video" },
            },
        },
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                "Watch history fetched successfully",
                user[0]?.watchHistory || []
            )
        );
};

export const handleGetChannelStats = async (req, res) => {
    if (!req.user) {
        throw new ApiError(
            401,
            "Unauthorized, please login to get channel stats"
        );
    }

    const userId = req.user._id;

    const user = await User.findById(userId).select("-password -refreshToken");

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const userStats = await User.aggregate([
        {
            $match: { _id: new mongoose.Types.ObjectId(userId) },
        },
        {
            $lookup: {
                from: "likes",
                localField: "myVideos",
                foreignField: "video",
                as: "likes",
            },
        },
        {
            $lookup: {
                from: "videos",
                localField: "myVideos",
                foreignField: "_id",
                as: "myVideos",
            },
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers",
            },
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscriptions",
            },
        },
        {
            $addFields: {
                totalLikes: { $size: "$likes" },
                totalViews: { $sum: "$myVideos.views" },
                totalSubscribers: { $size: "$subscribers" },
                totalSubscriptions: { $size: "$subscriptions" },
            },
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                avatar: 1,
                coverImage: 1,
                totalLikes: 1,
                totalViews: 1,
                totalSubscribers: 1,
                totalSubscriptions: 1,
            },
        },
    ]);

    if (!userStats?.length) {
        throw new ApiError(404, "User stats not found");
    }

    res.status(200).json(
        new ApiResponse(200, "Channel stats fetched", userStats[0])
    );
};

export const handleDeleteFromHistory = async (req, res) => {
    if (!req.user) {
        throw new ApiError(
            401,
            "Unauthorized, please login to delete from watch history"
        );
    }

    const { videoId } = req.params;

    if (!videoId?.trim()) {
        throw new ApiError(400, "Video ID is required");
    }

    const user = await User.findById(req.user?._id);

    if (!user) {
        throw new ApiError(404, "User not found while deleting from history");
    }

    const isVideoInHistory = user.watchHistory.some(
        (item) => item.video.toString() === videoId
    );

    if (!isVideoInHistory) {
        throw new ApiError(400, "Video not found in watch history");
    }

    user.watchHistory = user.watchHistory.filter(
        (item) => item.video.toString() !== videoId
    );

    await user.save({ validateBeforeSave: false });

    res.status(200).json(
        new ApiResponse(200, "Video deleted from watch history")
    );
};

export const handleGetSubscribers = async (req, res) => {
    if (!req.user) {
        throw new ApiError(
            401,
            "Unauthorized, please login to get subscribers"
        );
    }

    const userId = req.user._id;

    const subscribers = await User.aggregate([
        {
            $match: { _id: new mongoose.Types.ObjectId(userId) },
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "subscriber",
                            foreignField: "_id",
                            as: "subscriber",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1,
                                    },
                                },
                            ],
                        },
                    },
                    {
                        $addFields: {
                            subscriber: { $first: "$subscriber" },
                        },
                    },
                    {
                        $sort: {
                            createdAt: -1,
                        },
                    },
                    {
                        $project: {
                            subscriber: 1,
                            createdAt: 1,
                        },
                    },
                ],
            },
        },
    ]);

    if (subscribers.length === 0) {
        throw new ApiError(404, "No subscribers found");
    }

    res.status(200).json(
        new ApiResponse(200, "Subscribers fetched", subscribers[0].subscribers)
    );
};

export const handleGetSubscription = async (req, res) => {
    if (!req.user) {
        throw new ApiError(
            401,
            "Unauthorized, please login to get subscription details"
        );
    }

    const userId = req.user._id;

    const subscriptions = await User.aggregate([
        {
            $match: { _id: new mongoose.Types.ObjectId(userId) },
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscriptions",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "channel",
                            foreignField: "_id",
                            as: "subscription",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1,
                                    },
                                },
                            ],
                        },
                    },
                    {
                        $addFields: {
                            subscription: { $first: "$subscription" },
                        },
                    },
                    {
                        $sort: {
                            createdAt: -1,
                        },
                    },
                    {
                        $project: {
                            subscription: 1,
                            createdAt: 1,
                        },
                    },
                ],
            },
        },
    ]);

    if (subscriptions.length === 0) {
        throw new ApiError(404, "No subscription found");
    }

    res.status(200).json(
        new ApiResponse(
            200,
            "subscriptions fetched",
            subscriptions[0].subscriptions
        )
    );
};

export const handleDeleteUserAccount = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        if (!req.user) {
            throw new ApiError(
                401,
                "Unauthorized, please login to delete your account"
            );
        }

        session.startTransaction();

        await Like.deleteMany({ likedBy: req.user._id }).session(session);

        await Subscription.deleteMany({
            $or: [{ subscriber: req.user._id }, { channel: req.user._id }],
        }).session(session);

        await Video.deleteMany({ owner: req.user._id }).session(session);

        const deletedUser = await User.findByIdAndDelete(req.user._id, {
            session,
        });

        if (!deletedUser) {
            throw new ApiError(404, "User not found while deleting account");
        }

        await session.commitTransaction();

        res.status(200)
            .clearCookie("accessToken", global.accessTokenCookieOptions)
            .clearCookie("refreshToken", global.refreshTokenCookieOptions)
            .json(new ApiResponse(200, "Account deleted successfully"));
    } finally {
        // ALWAYS runs (success or error)
        await session.endSession();
    }
};
