const { RekognitionClient } = require("@aws-sdk/client-rekognition");
const { fromCognitoIdentityPool } = require("@aws-sdk/credential-providers");

const client = new RekognitionClient({
  region: "ap-northeast-1",
  credentials: fromCognitoIdentityPool({
    identityPoolId: process.env.IDENTITY_POOL_ID,
    clientConfig: { region: "ap-northeast-1" },
  }),
});

const compareClient = new RekognitionClient({
  region: "ap-northeast-1",
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  },
});

module.exports = { client, compareClient };
