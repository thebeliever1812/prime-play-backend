import { Schema, model } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

export const UserSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            lowerCase: true,
            trim: true,
            index: true,
        },
        fullName: {
            type: String,
            required: true,
            unique: false,
            trim: true,
            index: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowerCase: true,
            trim: true,
        },
        password: {
            type: String,
            required: [true, "Password is required"],
        },
        avatar: {
            type: String,
            default: "/default_avatar.png",
        },
        avatarImageId: {
            type: String,
            default: null,
        },
        coverImage: {
            type: String,
            default: "/default_cover_image.jpeg",
        },
        coverImageId: {
            type: String,
            default: null,
        },
        myVideos: [
            {
                type: Schema.Types.ObjectId,
                ref: "Video",
            },
        ],
        watchHistory: [
            {
                video: {
                    type: Schema.Types.ObjectId,
                    ref: "Video",
                },
                watchedAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        refreshToken: {
            type: String,
        },
    },
    { timestamps: true }
);

UserSchema.pre("save", async function (next) {
    if (!this.isModified("password")) {
        return next();
    }
    try {
        this.password = await bcrypt.hash(this.password, 10);
        next();
    } catch (error) {
        console.log("Password failed to hashed:", error);
        next(error);
    }
});

UserSchema.methods.matchPassword = async function (password) {
    return await bcrypt.compare(password, this.password);
};

UserSchema.methods.generateAccessToken = function () {
    const payload = {
        _id: this._id,
        username: this.username,
        fullName: this.fullName,
        email: this.email,
        avatar: this.avatar,
        coverImage: this.coverImage,
    };
    const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;
    const accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRY;

    return jwt.sign(payload, accessTokenSecret, {
        expiresIn: accessTokenExpiry,
    });
};

UserSchema.methods.generateRefreshToken = function () {
    const payload = {
        _id: this._id,
    };
    const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;
    const refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY;

    return jwt.sign(payload, refreshTokenSecret, {
        expiresIn: refreshTokenExpiry,
    });
};

export const User = model("User", UserSchema);
