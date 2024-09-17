const fs = require("fs");
const path = require("path");
const util = require("util");

// promisify
const writeFileAsync = util.promisify(fs.writeFile);
const mkdirAsync = util.promisify(fs.mkdir);

// base64 to image converter and saves it as a file
async function saveBase64AsImage(base64String, folderPath, filename) {
  // Determine file type from base64 prefix
  let fileType = "png"; // default to png
  let base64Data = base64String;

  if (base64String.startsWith("data:image/")) {
    const matches = base64String.match(/^data:image\/([A-Za-z-+\/]+);base64,/);
    if (matches && matches.length > 1) {
      fileType = matches[1].toLowerCase();
      base64Data = base64String.replace(
        /^data:image\/[A-Za-z-+\/]+;base64,/,
        ""
      );
    }
  }

  // Ensure filename has the correct extension
  if (!filename.toLowerCase().endsWith(`.${fileType}`)) {
    filename = `${filename}.${fileType}`;
  }

  // Create a buffer from the base64 string
  const imageBuffer = Buffer.from(base64Data, "base64");

  // Ensure the folder exists
  try {
    await mkdirAsync(folderPath, { recursive: true });
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
  }

  // Determine the full file path
  const filePath = path.join(folderPath, filename);

  // Write the buffer to a file
  try {
    await writeFileAsync(filePath, imageBuffer);
    console.log("Image saved successfully:", filePath);
    return filename;
  } catch (err) {
    console.error("Error saving the image:", err);
    throw err;
  }
}

// array bytes to image converter and saves it as a file
async function saveByteArrayAsImage(
  byteArray,
  folderPath,
  filename,
  fileType = "png"
) {
  // Ensure filename has the correct extension
  if (!filename.toLowerCase().endsWith(`.${fileType}`)) {
    filename = `${filename}.${fileType}`;
  }

  // Create a buffer from the byte array
  const imageBuffer = Buffer.from(byteArray);

  // Ensure the folder exists
  try {
    await fs.mkdir(folderPath, { recursive: true });
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
  }

  // Determine the full file path
  const filePath = path.join(folderPath, filename);

  // Write the buffer to a file
  try {
    await fs.writeFile(filePath, imageBuffer);
    console.log("Image saved successfully:", filePath);
    return filename;
  } catch (err) {
    console.error("Error saving the image:", err);
    throw err;
  }
}

async function createBufferFromImage(imagePath) {
  try {
    // Read the file
    const buffer = await fs.readFile(imagePath);

    // Convert buffer to byte array
    const byteArray = Array.from(buffer);

    console.log("Image converted to byte array successfully");
    console.log("Byte array length:", byteArray.length);

    return byteArray;
  } catch (error) {
    console.error("Error reading image file:", error);
    throw error;
  }
}

module.exports = {
  saveBase64AsImage,
  saveByteArrayAsImage,
  createBufferFromImage,
};
