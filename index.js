const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");

// for image
const fs = require("fs");
const path = require("path");
const util = require("util");
// grab env
dotenv.config();

//
const cors = require("cors");
const { CompareFacesCommand } = require("@aws-sdk/client-rekognition");
const verifyRouter = require("./routers/verify-route");
const tokenRouter = require("./routers/token-route");
const awsCreateRouter = require("./routers/aws-create-route");
const awsLivenessResultRouter = require("./routers/aws-liveness-result-route");
const { compareClient } = require("./utils/aws-clients");
const awsFetchSessionRouter = require("./routers/aws-fetch-session");

// Create Express app
const app = express();

// promisify
const readFileAsync = util.promisify(fs.readFile);

app.use(cors());

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Server Port
const PORT = process.env.PORT || 8089;

app.use("/verify", verifyRouter);

app.use("/token", tokenRouter);

app.use("/create-liveness", awsCreateRouter);

app.use("/liveness-results", awsLivenessResultRouter);

app.use("/results", awsFetchSessionRouter);

app.get("/test", async (req, res) => {
  try {
    // Simple response to test if the server is running
    const filePath1 = path.join(__dirname, "temporary", "posty1.jpeg");
    const filePath2 = path.join(__dirname, "temporary", "maloney1.jpeg");

    const [buffer1, buffer2] = await Promise.all([
      readFileAsync(filePath1),
      readFileAsync(filePath2),
    ]);

    const input = {
      SourceImage: { Bytes: buffer1 },
      TargetImage: { Bytes: buffer2 },
      SimilarityThreshold: 70,
    };

    const command = new CompareFacesCommand(input);
    const response = await compareClient.send(command);

    res.json({
      response,
      message: "Test endpoint is working",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in test endpoint:", error);
    res.status(500).json({ error: "An error occurred during the test" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
