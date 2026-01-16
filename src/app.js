import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { verifyJWT } from "./middlewares/auth.middleware.js";

const app = express();

// const isProduction = process.env.NODE_ENV === "production";

global.accessTokenCookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000,
};

global.refreshTokenCookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 10 * 24 * 60 * 60 * 1000,
};

app.use(
    cors({
        origin: [
            process.env.FRONTEND_URL_LOCAL,
            process.env.FRONTEND_URL_PROD,
            "https://3tkg6xtw-3000.inc1.devtunnels.ms",
        ],
        credentials: true,
    })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));
app.use(cookieParser());
app.use(verifyJWT);

// routes import
import userRouter from "./routes/user.routes.js";
import videoRouter from "./routes/video.routes.js";
import authRouter from "./routes/auth.routes.js";
import subscribeRouter from "./routes/subscribe.routes.js";
import commentRouter from "./routes/comment.routes.js";
import likeRouter from "./routes/like.routes.js";
import tipRouter from "./routes/tip.routes.js"
import notificationRouter from "./routes/notification.routes.js"

// routes declaration
app.use("/api/v1/user", userRouter);

app.use("/api/v1/video", videoRouter);

app.use("/api/v1/auth", authRouter);

app.use("/api/v1/subscribe", subscribeRouter);

app.use("/api/v1/comment", commentRouter);

app.use("/api/v1/like", likeRouter);

app.use("/api/v1/tip", tipRouter);

app.use("/api/v1/notification", notificationRouter)

export default app;
