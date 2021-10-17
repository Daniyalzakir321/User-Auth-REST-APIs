const mongoose = require("mongoose");
const validator = require('validator');

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true,
      validate:{
      validator: validator.isEmail,
      message: '{VALUE} is not a valid email',
      isAsync: false }
    },
    password: { type: String, required: true },
    profilePic: { type: String, defaut: "" },
    otp: { type: String, default: "" },
    isAdmin: { type: Boolean, default: false },
    emailConfirm: { type: Boolean, default: false },
    otpConfirm: { type: Boolean, default: false },


  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);