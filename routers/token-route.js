const express = require("express");

const { token } = require("../controllers/token-controller.js");

const tokenRouter = express.Router();

tokenRouter.post("", token);

module.exports = tokenRouter;
