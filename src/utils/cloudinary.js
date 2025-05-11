import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY,
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return "File Not Found!" || null;

    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    fs.unlinkSync(localFilePath); // remove the local saved file after successful upload
    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath); // remove the local saved file if upload fails
    return null;
  }
};

const deleteFromCloudinary = async (findePost) => {
  try {
    if (!findePost) return "File Not Found!" || null;

    const oldThumbnail = findePost.thumbnail;
    const splitThumbnail = oldThumbnail.split("/");
    const thumbnailFile = splitThumbnail[splitThumbnail.length - 1];
    const splitDotThumbnail = thumbnailFile.split(".")[0];

    await cloudinary.uploader.destroy(splitDotThumbnail, {
      resource_type: "auto",
    });
  } catch (error) {
    return null;
  }
};

export { uploadOnCloudinary, deleteFromCloudinary };
