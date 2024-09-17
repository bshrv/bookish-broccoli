const express = require("express");

const {
  fetchsession,
} = require("../controllers/aws-fetch-session-controller.js");

const awsFetchSessionRouter = express.Router();

awsFetchSessionRouter.get("", fetchsession);

module.exports = awsFetchSessionRouter;
