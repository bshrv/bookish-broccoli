const express = require("express");

const { verify } = require("../controllers/verify-controller.js");

const verifyRouter = express.Router();

verifyRouter.get("", verify);

module.exports = verifyRouter;
