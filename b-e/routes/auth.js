const router = require("express").Router();
const jwt = require("jsonwebtoken");
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const validator = require('validator');
const AuthDB = require("../models/User");
require('dotenv').config();

//REGISTER
router.post("/register", async (req, res) => {
    try {
        const { email, password, username } = req.body
        console.log(email, password)
        // Check email pass
        if (!email || !password) return res.status(400).json({ message: 'Enter email and password to signup' })
        const emailValidator = validator.isEmail(email);
        if (!emailValidator) return res.status(400).json({ message: 'Email is not valid ' })
        if (email.length < 3 || password.length < 8) return res.status(400).json({ message: 'Email password length is to short signup' })
        // Check email username
        const userName = await AuthDB.findOne({ username: username });
        if (userName) return res.status(401).json("Username already taken");
        const user = await AuthDB.findOne({ email })
        if (user) return res.status(400).json({ message: 'User already exists' })
        if (email && password) {
            // Making hash pass by using bcrypt 
            const salt = bcrypt.genSalt()
            const hash_password = bcrypt.hashSync(password, 10).toString()
            if (!hash_password) return res.status(400).json({ message: 'Password is not valid for signup' })
            const user = new AuthDB({
                username: username,
                email: email,
                password: hash_password,
            })
            const result = await user.save()
            console.log("result=======", result)
            res.status(200).json({ message: "User Successfully Registered" })
            //  Sending activation email to user ==========
            const emailToken = await jwt.sign(
                { id: result._id, isAdmin: result.isAdmin }, //JWT token made with user id and isAdmin
                process.env.SECRET_KEY,
                { expiresIn: "1h" }
            );
            if (!emailToken) return res.status(400).json({ message: 'No Token Exists' })
            console.log("emailToken=======", emailToken)

            if (result) {
                const transporter = nodemailer.createTransport({
                    host: 'smtp.ethereal.email',
                    port: 587,
                    auth: {
                        user: process.env.SMTP_EMAIL,
                        pass: process.env.SMTP_PASSWORD
                    }
                });
                var mailOptions = {
                    from: process.env.SMTP_EMAIL,
                    to: email,
                    subject: 'Activate Your Account',
                    text: 'That was easy! Place your HTML Inside',
                    html: `
                    <b>A confirmation email has been send to you by olx 
                    <a target="_blank" 
                    href="http://localhost:${process.env.PORT || 8000}/api/auth/confirmation/${emailToken}">
                    Click here</a> to activate your account </b>
                `};
                await transporter.sendMail(mailOptions, function (error, info) {
                    if (error) {
                        console.log(error);
                        res.status(400).json({ message: error })
                    } else {
                        console.log('Email sent: ' + info.response);
                        res.status(200).json({
                            message: "A confirmation email has been re-send. Please Check Your Account",
                            email_message: 'Email sent: ' + info.response
                        })
                    }
                });
            }
            // ==============
        }
    }
    catch (error) {
        res.status(400).json({ message: error.message })
    }
});



//Confirm Email
router.get("/confirmation/:token", async (req, res) => {
    const { token } = req.params
    const uri = "http://localhost:8080/api/auth/login"
    try {
        if (token && token.length) {
            return jwt.verify(token, process.env.SECRET_KEY, async function (err, user) {
                console.log("user==", user)
                if (err) return res.status(400).json({ message: "Activation link expires" })
                if (user) {
                    const demo = await AuthDB.findById({ _id: user.id })
                    console.log("demo==", demo)
                    if (demo.emailConfirm) {
                        return res.status(200).json({ message: "Email already confirm" })
                        // return res.redirect(uri) // thi works need to find a way to put our message eith redirect url
                    }
                    const active = await AuthDB.findByIdAndUpdate(user.id, { emailConfirm: true }, { new: true })
                    console.log("active==", active)
                    if (active.emailConfirm) return res.status(200).json({ message: "Your email has been confirm. Login to continue" })
                }
                return res.redirect(uri)
            })
        }
    }
    catch (error) {
        return res.status(400).json({ message: error.message })
    }
    return res.redirect(uri)
});


// RESEND EMAIL
router.post("/resend-email", async (req, res) => {
    try {
        const { email } = req.body
        console.log(email)
        // Check email pass
        const emailValidator = validator.isEmail(email);
        if (!emailValidator) return res.status(400).json({ message: 'Email is not valid ' })
        if (email.length < 3) return res.status(400).json({ message: 'Email length is to short ' })
        const user = await AuthDB.findOne({ email })
        if (!user) return res.status(400).json({ message: 'No email exists for resend' })
        //   ==========
        //  Sending activation email to user
        const emailToken = await jwt.sign(
            { id: user._id, isAdmin: user.isAdmin }, //JWT token made with user id and isAdmin
            process.env.SECRET_KEY,
            { expiresIn: "1h" }
        );
        if (!emailToken) return res.status(400).json({ message: 'Activation email expires' })
        console.log("emailToken=======", emailToken)
        // ==========
        if (user.email) {
            const transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                auth: {
                    user: process.env.SMTP_EMAIL,
                    pass: process.env.SMTP_PASSWORD
                }
            });
            var mailOptions = {
                from: process.env.SMTP_EMAIL,
                to: user.email,
                subject: 'Resend Email: Activate Your Account',
                text: 'That was easy! Place your HTML Inside',
                html: `
                    <b>A confirmation email has been re-send to you by olx 
                    <a target="_blank" 
                    href="http://localhost:${process.env.PORT || 8000}/api/auth/confirmation/${emailToken}">
                    Click here</a> to activate your account </b>
                `};
            await transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    console.log(error);
                    res.status(400).json({ message: error })
                } else {
                    console.log('Email sent: ' + info.response);
                    res.status(200).json({
                        message: "A confirmation email has been re-send. Please Check Your Account",
                        email_message: 'Email sent: ' + info.response
                    })
                }
            });
        }
        // ==============
    }
    catch (error) {
        res.status(400).json({ message: error.message })
    }
});


// FORGOT EMAIL
router.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body
        console.log(email)
        // Check email pass
        const emailValidator = validator.isEmail(email);
        if (!emailValidator) return res.status(400).json({ message: 'Email is not valid ' })
        if (email.length < 3) return res.status(400).json({ message: 'Email length is to short ' })
        const user = await AuthDB.findOne({ email })
        if (!user) return res.status(400).json({ message: 'No email exists. Please Signup to continue!' })
        const emailToken = await jwt.sign(
            { id: user._id, isAdmin: user.isAdmin }, //JWT token made with user id and isAdmin
            process.env.SECRET_KEY,
            { expiresIn: "1h" }
        );
        if (!emailToken) return res.status(400).json({ message: 'Activation email expires' })
        console.log("emailToken=======", emailToken)
        //  Sending activation email to user ==========
        if (user.email) {
            const transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                auth: {
                    user: process.env.SMTP_EMAIL,
                    pass: process.env.SMTP_PASSWORD
                }
            });
            var mailOptions = {
                from: process.env.SMTP_EMAIL,
                to: user.email,
                subject: 'Forgot Password: Verify Email',
                text: 'That was easy! Place your HTML Inside',
                html: `
                    <b>Verify your email  
                    <a target="_blank" 
                    href="http://localhost:${process.env.PORT || 8000}/api/auth/change-password/${emailToken}">
                    Click here</a> to change your password</b>
                `};
            await transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    console.log(error);
                    res.status(400).json({ message: error })
                } else {
                    console.log('Email sent: ' + info.response);
                    res.status(200).json({
                        message: "Reset Passsword: A confirmation email has been send. Please Check Your Account",
                        email_message: 'Email sent: ' + info.response
                    })
                }
            });
        }
        // ==============
    }
    catch (error) {
        res.status(400).json({ message: error.message })
    }
});


// CHANGE-PASSWORD
router.get("/change-password/:token", async (req, res) => {
    const { token } = req.params
    const uri = "http://localhost:8080/api/auth/login"
    try {
        if (token && token.length) {
            return jwt.verify(token, process.env.SECRET_KEY, async function (err, user) {
                console.log("user==", user)
                if (err) return res.status(400).json({ message: "Activation link expires" })
                if (user) {
                    const demo = await AuthDB.findById({ _id: user.id })
                    console.log("demo==", demo)
                    if (demo.emailConfirm) {
                        return res.redirect(`http://localhost:8080/api/auth/login?id=${demo._id}`) // this works need to find a way to put our message eith redirect url
                    }
                }
                return res.redirect(uri)
            })
        }
    }
    catch (error) {
        return res.status(400).json({ message: error.message })
    }
    return res.redirect(uri)
});

// UPDATE-PASSWORD
router.post("/update-password", async (req, res) => {
        const { id } = req.query
        const { password, confirmPassword } = req.body
        console.log("result=======", req.query)
    try {
        if (password !== confirmPassword) return res.status(400).json({ message: 'Password and confirm password should be same' })
        if (!id && !password) return res.status(400).json({ message: 'Enter password to signup' })
        if (id.length < 5 && password.length < 8) return res.status(400).json({ message: 'Password length is to short signup' })
        const user = await AuthDB.findById({ _id: id })
        if (!user) return res.status(400).json({ message: 'User does ot exists' })
        if (id && password) {
            const hash_password = bcrypt.hashSync(password, 10).toString()
            if (!hash_password) return res.status(400).json({ message: 'Password is not valid for signup' })
            const result = await AuthDB.findByIdAndUpdate({ _id: id }, { password: hash_password }, { new: true })
            console.log("result=======", result)
            res.status(200).json({ message: "Password hage successfully" })
        }
    }
    catch (error) {
        res.status(400).json({ message: error.message })
    }
});


//LOGIN
router.post("/login", async (req, res) => {
    const email = req.body.email
    const pass = req.body.password
    console.log('RRRR= : ', req.body)
    try {
        if (!email || !pass) return res.status(400).json({ message: 'Enter Email Password Login' })
        const emailValidator = validator.isEmail(email);
        if (!emailValidator) return res.status(400).json({ message: 'Email is not valid ' })
        if (email.length < 8 || pass.length < 8) return res.status(400).json({ message: 'Email Password Length Is Too Short Login' })
        if (email && pass) {
            // if user exists
            const user = await AuthDB.findOne({ email })
            if (!user) return res.status(400).json({ message: 'No email exists' })
            if (user && user.password) {
                // Comparing pass to login
                const comparePassword = await bcrypt.compare(pass, user.password)
                if (!comparePassword) return res.status(400).json({ message: "Wrong password or username!" })
                // Confirm your account by email verification if emailConfirm is true
                if (!user.emailConfirm) return res.status(400).json({ message: "Please confirm your account!" })
                // if otp is true
                if (!user.otpConfirm) return res.status(400).json({ message: 'Please verify OTP' })
                // Generating JWT token and send it to user
                const token = await jwt.sign(
                    { id: user._id, isAdmin: user.isAdmin }, //JWT token made with user id and isAdmin
                    process.env.SECRET_KEY,
                    { expiresIn: "5d" }
                );
                console.log(token)
                if (!token) return res.status(400).json({ message: 'No Token Exists' })
                const { password, isAdmin, otp, otpConfirm, emailConfirm, ...info } = user._doc;
                res.status(200).json({ ...info, token });
            }
        }
    }
    catch (error) {
        res.status(400).json({ message: error.message })
    }
});


// SEND OTP TO EMAIL
router.post("/send-otp", async (req, res) => {
    try {
        const { email } = req.body
        console.log(email,)
        // Check email pass
        if (!email) return res.status(400).json({ message: 'Enter email to send otp' })
        const emailValidator = validator.isEmail(email);
        if (!emailValidator) return res.status(400).json({ message: 'Email is not valid ' })
        if (email.length < 3) return res.status(400).json({ message: 'Email length is to short' })
        // Making hash otp by using jwt 
        const otp = (Math.floor(100000 + Math.random() * 900000)).toString()
        const otpToken = await jwt.sign({ otp }, process.env.SECRET_KEY, { expiresIn: "300s" });
        if (!otpToken) return res.status(400).json({ message: 'No otp exists' })
        const user = await AuthDB.findOneAndUpdate({ email }, { otp: otpToken }, { new: true })
        if (!user) return res.status(400).json({ message: 'No email exists. Please signup to continue!' })
        console.log(user)
        //  Sending activation email to user with otp  ==========
        if (user.email) {
            const transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                auth: {
                    user: process.env.SMTP_EMAIL,
                    pass: process.env.SMTP_PASSWORD
                }
            });
            var mailOptions = {
                from: process.env.SMTP_EMAIL,
                to: user.email,
                subject: 'Activate Your Account',
                text: 'That was easy! Place your HTML Inside',
                html: `<b>Otp has been send to you by olx <h2>${otp}</h2> to activate your account.</b>`
            };
            await transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    console.log(error);
                    res.status(400).json({ message: error })
                } else {
                    console.log('Email sent: ' + info.response);
                    res.status(200).json({
                        message: "Otp has been send. Please Check Your Account",
                        email_message: 'Email sent: ' + info.response
                    })
                }
            });
        }
        // ==============
    }
    catch (error) {
        res.status(400).json({ message: error.message })
    }
});


// OTP Verify
router.post("/otp-verify", async (req, res) => {
    try {
        const { email, otp } = req.body
        console.log(email,)
        // Check email pass
        if (!email && !otp) return res.status(400).json({ message: 'Enter email or otp' })
        const emailValidator = validator.isEmail(email);
        if (!emailValidator) return res.status(400).json({ message: 'Email is not valid ' })
        if (email.length < 3) return res.status(400).json({ message: 'Email length is to short' })
        const userObj = await AuthDB.findOne({ email })
        console.log(userObj)
        if (!userObj) return res.status(400).json({ message: 'No email exists. Please signup to continue!' })
        if (!userObj.otp) return res.status(400).json({ message: 'No otp exists. Please signup to continue!' })
        if (userObj.otp) {
            jwt.verify(userObj.otp, process.env.SECRET_KEY, async function (err, user) {
                console.log("user==", user)
                if (err) return res.status(400).json({ message: "OTP has been expired" })
                if (user) {
                    const otpActive = await AuthDB.findOneAndUpdate({ email: userObj.email }, { otpConfirm: true }, { new: true })
                    console.log("otpActive==", otpActive)
                    if (otpActive.otpConfirm) return res.status(200).json({ message: "Your email has been confirm. Login to continue" })
                }
            })
        }
    }
    catch (error) {
        res.status(400).json({ message: error.message })
    }
});


module.exports = router;