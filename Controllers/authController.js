const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const User = require("../Models/userModel");

const {
  sendTemplate,
} = require("../services/emailservice");

/*
|--------------------------------------------------------------------------
| Configuration
|--------------------------------------------------------------------------
*/

const OTP_EXPIRATION_MINUTES = 10;

/*
|--------------------------------------------------------------------------
| JWT
|--------------------------------------------------------------------------
*/

const generateToken = (id) => {
  return jwt.sign(
    {
      id,
      type: "user",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

/*
|--------------------------------------------------------------------------
| Safe User
|--------------------------------------------------------------------------
*/

const safeUser = (user) => ({
  _id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
  isEmailVerified: user.isEmailVerified,
});

/*
|--------------------------------------------------------------------------
| Hash
|--------------------------------------------------------------------------
*/

const hashValue = (value) => {
  return crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex");
};

/*
|--------------------------------------------------------------------------
| Generate 6-Digit OTP
|--------------------------------------------------------------------------
*/

const generateOtp = () => {
  return crypto
    .randomInt(100000, 1000000)
    .toString();
};

/*
|--------------------------------------------------------------------------
| Send Email
|--------------------------------------------------------------------------
|
| Email failure is logged so we don't hide problems.
|
|--------------------------------------------------------------------------
*/

const deliver = async (kind, args) => {
  try {
    await sendTemplate(kind, args);

    console.log(`[EMAIL][${kind}] sent successfully`);
  } catch (error) {
    console.error(
      `[EMAIL][${kind}] delivery failed:`,
      error.message
    );

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| REGISTER
|--------------------------------------------------------------------------
|
| POST /auth/register
|
| Body:
|
| {
|   "firstName": "Daniel",
|   "lastName": "Ben",
|   "email": "daniel@example.com",
|   "password": "password123"
| }
|
|--------------------------------------------------------------------------
*/

exports.register = async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    password,
  } = req.body;

  /*
  |--------------------------------------------------------------------------
  | Validate Input
  |--------------------------------------------------------------------------
  */

  if (
    ![firstName, lastName, email, password].every(
      (value) =>
        typeof value === "string" &&
        value.trim()
    )
  ) {
    return res.status(400).json({
      success: false,
      error: "All fields are required",
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Password Length
  |--------------------------------------------------------------------------
  */

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      error: "Password must be at least 6 characters",
    });
  }

  try {
    const normalizedEmail = email
      .trim()
      .toLowerCase();

    /*
    |--------------------------------------------------------------------------
    | Check Existing User
    |--------------------------------------------------------------------------
    */

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      /*
      | If already verified, don't allow another registration.
      */

      if (existingUser.isEmailVerified) {
        return res.status(400).json({
          success: false,
          error: "Email already exists",
        });
      }


      const otp = generateOtp();

      existingUser.emailVerificationOtp =
        hashValue(otp);

      existingUser.emailVerificationOtpExpire =
        new Date(
          Date.now() +
            OTP_EXPIRATION_MINUTES * 60 * 1000
        );

      await existingUser.save();

      try {
        await deliver("verification", {
          to: existingUser.email,
          firstName: existingUser.firstName,
          otp,
        });
      } catch {
        return res.status(500).json({
          success: false,
          error:
            "Account exists but we could not send the verification code. Please try again.",
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Account already exists but has not been verified. A new verification code has been sent.",
        data: {
          email: existingUser.email,
          isEmailVerified:
            existingUser.isEmailVerified,
        },
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Generate OTP
    |--------------------------------------------------------------------------
    */

    const otp = generateOtp();

    const otpHash = hashValue(otp);

    /*
    |--------------------------------------------------------------------------
    | Create User
    |--------------------------------------------------------------------------
    */

    const user = new User({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      password,
      role: "user",

      isEmailVerified: false,

      emailVerificationOtp: otpHash,

      emailVerificationOtpExpire: new Date(
        Date.now() +
          OTP_EXPIRATION_MINUTES * 60 * 1000
      ),
    });



    await user.save();

 

    try {
      await deliver("verification", {
        to: user.email,
        firstName: user.firstName,
        otp,
      });
    } catch (emailError) {
     

      await User.findByIdAndDelete(user._id);

      return res.status(500).json({
        success: false,
        error:
          "Account could not be created because the verification email could not be sent. Please try again.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Response
    |--------------------------------------------------------------------------
    |
    | IMPORTANT:
    | No JWT is returned here.
    |
    |--------------------------------------------------------------------------
    */

    return res.status(201).json({
      success: true,
      message:
        "Account created successfully. Please check your email for your verification code.",
      data: {
        email: user.email,
        isEmailVerified: false,
      },
    });
  } catch (error) {
    /*
    |--------------------------------------------------------------------------
    | Duplicate Email
    |--------------------------------------------------------------------------
    */

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Email already exists",
      });
    }

    console.error("[AUTH][REGISTER]", error);

    return res.status(500).json({
      success: false,
      error: "Unable to register user",
    });
  }
};

/*
|--------------------------------------------------------------------------
| VERIFY EMAIL
|--------------------------------------------------------------------------
|
| POST /auth/verify-email
|
| Body:
|
| {
|   "email": "daniel@example.com",
|   "otp": "482913"
| }
|
|--------------------------------------------------------------------------
*/

exports.verifyEmail = async (req, res) => {
  const { email, otp } = req.body;

  // --------------------------------------------------------------------------
  // Validate
  // --------------------------------------------------------------------------

  if (
    typeof email !== "string" ||
    !email.trim() ||
    typeof otp !== "string" ||
    !otp.trim()
  ) {
    return res.status(400).json({
      success: false,
      error: "Email and verification code are required",
    });
  }

  // --------------------------------------------------------------------------
  // Validate OTP Format
  // --------------------------------------------------------------------------

  const trimmedOtp = otp.trim();

  if (!/^\d{6}$/.test(trimmedOtp)) {
    return res.status(400).json({
      success: false,
      error: "Verification code must be 6 digits",
    });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();

    // --------------------------------------------------------------------------
    // Find User
    // --------------------------------------------------------------------------

    const user = await User.findOne({
      email: normalizedEmail,
    }).select(
      "+emailVerificationOtp +emailVerificationOtpExpire"
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        error: "Invalid verification code",
      });
    }

    // --------------------------------------------------------------------------
    // Already Verified
    // --------------------------------------------------------------------------

    if (user.isEmailVerified) {
      return res.status(200).json({
        success: true,
        message: "Email is already verified",
        data: {
          user: safeUser(user),
        },
      });
    }

    // --------------------------------------------------------------------------
    // Check OTP Exists
    // --------------------------------------------------------------------------

    if (
      !user.emailVerificationOtp ||
      !user.emailVerificationOtpExpire
    ) {
      return res.status(400).json({
        success: false,
        error:
          "No active verification code. Please request a new code.",
      });
    }

    // --------------------------------------------------------------------------
    // Check OTP Expiration
    // --------------------------------------------------------------------------

    if (
      new Date(user.emailVerificationOtpExpire) <= new Date()
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Verification code has expired. Please request a new code.",
      });
    }

    // --------------------------------------------------------------------------
    // Validate Stored OTP Hash
    // --------------------------------------------------------------------------

    const storedOtpHash = user.emailVerificationOtp;

    if (
      typeof storedOtpHash !== "string" ||
      !/^[a-fA-F0-9]{64}$/.test(storedOtpHash)
    ) {
      console.error(
        "[AUTH][VERIFY_EMAIL] Invalid stored OTP hash:",
        storedOtpHash
      );

      return res.status(400).json({
        success: false,
        error:
          "Invalid verification code. Please request a new code.",
      });
    }

    // --------------------------------------------------------------------------
    // Hash Provided OTP
    // --------------------------------------------------------------------------

    const providedOtpHash = hashValue(trimmedOtp);

    // --------------------------------------------------------------------------
    // Compare OTP Hashes
    // --------------------------------------------------------------------------

    const isValidOtp = crypto.timingSafeEqual(
      Buffer.from(providedOtpHash, "hex"),
      Buffer.from(storedOtpHash, "hex")
    );

    if (!isValidOtp) {
      return res.status(400).json({
        success: false,
        error: "Invalid verification code",
      });
    }

    // --------------------------------------------------------------------------
    // Verify Email
    // --------------------------------------------------------------------------

    user.isEmailVerified = true;

    // Clear OTP after successful verification
    user.emailVerificationOtp = undefined;
    user.emailVerificationOtpExpire = undefined;

    await user.save();

    // Send welcome email after successful verification
try {
  await sendTemplate("welcome", {
    to: user.email,
    firstName: user.firstName,
  });
} catch (emailError) {
  console.error(
    "[AUTH][WELCOME_EMAIL]",
    emailError
  );

  // Do NOT fail email verification just because the welcome email failed.
}

    return res.status(200).json({
      success: true,
      message: "Email verified successfully",
      data: {
        user: safeUser(user),
      },
    });
  } catch (error) {
    console.error("[AUTH][VERIFY_EMAIL]", error);

    return res.status(500).json({
      success: false,
      error: "Unable to verify email",
      details: error.message,
    });
  }
};


exports.resendVerificationOtp = async (
  req,
  res
) => {
  const { email } = req.body;

  /*
  |--------------------------------------------------------------------------
  | Validate
  |--------------------------------------------------------------------------
  */

  if (
    typeof email !== "string" ||
    !email.trim()
  ) {
    return res.status(400).json({
      success: false,
      error: "Email is required",
    });
  }

  try {
    const normalizedEmail = email
      .trim()
      .toLowerCase();

    /*
    |--------------------------------------------------------------------------
    | Find User
    |--------------------------------------------------------------------------
    */

    const user = await User.findOne({
      email: normalizedEmail,
    });

    /*
    |--------------------------------------------------------------------------
    | Don't reveal whether account exists
    |--------------------------------------------------------------------------
    */

    if (!user) {
      return res.status(200).json({
        success: true,
        message:
          "If an account exists with that email, a verification code has been sent.",
      });
    }



    if (user.isEmailVerified) {
      return res.status(200).json({
        success: true,
        message: "Email is already verified",
      });
    }



    const otp = generateOtp();

    user.emailVerificationOtp =
      hashValue(otp);

    user.emailVerificationOtpExpire =
      new Date(
        Date.now() +
          OTP_EXPIRATION_MINUTES * 60 * 1000
      );

    await user.save();



    try {
      await deliver("verification", {
        to: user.email,
        firstName: user.firstName,
        otp,
      });
    } catch (error) {
      console.error(
        "[AUTH][RESEND_OTP]",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to send verification code. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "A new verification code has been sent to your email.",
    });
  } catch (error) {
    console.error(
      "[AUTH][RESEND_VERIFICATION]",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        "Unable to resend verification code",
    });
  }
};



exports.login = async (req, res) => {
  const {
    email,
    password,
  } = req.body;


  if (
    typeof email !== "string" ||
    !email.trim() ||
    typeof password !== "string" ||
    !password
  ) {
    return res.status(400).json({
      success: false,
      error: "Email and password are required",
    });
  }

  try {
    const normalizedEmail = email
      .trim()
      .toLowerCase();

   

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");



    if (
      !user ||
      !(await user.matchPassword(password))
    ) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

 

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        error:
          "Please verify your email before logging in",
        code: "EMAIL_NOT_VERIFIED",
        data: {
          email: user.email,
        },
      });
    }



    const token = generateToken(user._id);



    return res.status(200).json({
      success: true,
      message: `Welcome ${user.firstName}!`,
      data: {
        user: safeUser(user),
        token,
      },
    });
  } catch (error) {
    console.error("[AUTH][LOGIN]", error);

    return res.status(500).json({
      success: false,
      error: "Unable to log in",
    });
  }
};



exports.forgotPassword = async (req, res) => {
  const genericResponse = {
    success: true,
    message:
      "If an account exists for that email, password reset instructions have been sent.",
  };

  if (
    !req.body ||
    typeof req.body.email !== "string" ||
    !req.body.email.trim()
  ) {
    return res.status(200).json(
      genericResponse
    );
  }

  try {
    const normalizedEmail = req.body.email
      .trim()
      .toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    if (!user) {
      return res.status(200).json(
        genericResponse
      );
    }

 

    const rawToken = user.createHashedToken(
      "resetPasswordToken",
      "resetPasswordExpire",
      60
    );

    await user.save();

    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.PLATFORM_URL ||
      "https://sankofaseek.com";

    const resetLink =
      `${frontendUrl.replace(/\/$/, "")}` +
      `/reset-password?token=${encodeURIComponent(
        rawToken
      )}`;

    try {
      await deliver("passwordReset", {
        to: user.email,
        firstName: user.firstName,
        resetLink,
        expirationTime: "1 hour",
      });
    } catch (emailError) {
      console.error(
        "[AUTH][FORGOT_PASSWORD][EMAIL]",
        emailError
      );
    }

    return res.status(200).json(
      genericResponse
    );
  } catch (error) {
    console.error(
      "[AUTH][FORGOT_PASSWORD]",
      error
    );

    return res.status(200).json(
      genericResponse
    );
  }
};

/*
|--------------------------------------------------------------------------
| RESET PASSWORD
|--------------------------------------------------------------------------
*/

exports.resetPassword = async (req, res) => {
  const {
    token,
    password,
  } = req.body;

  if (
    typeof token !== "string" ||
    !token.trim() ||
    typeof password !== "string" ||
    password.length < 6
  ) {
    return res.status(400).json({
      success: false,
      error:
        "A valid token and password of at least 6 characters are required",
    });
  }

  try {
    const user = await User.findOne({
      resetPasswordToken: hashValue(
        token.trim()
      ),
      resetPasswordExpire: {
        $gt: new Date(),
      },
    }).select("+password");

    if (!user) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired reset token",
      });
    }



    user.password = password;

    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error(
      "[AUTH][RESET_PASSWORD]",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Unable to reset password",
    });
  }
};


exports.getProfile = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: req.user,
  });
};



exports.updateProfile = async (req, res) => {
  const fieldsToUpdate = {};

  if (
    typeof req.body.firstName === "string" &&
    req.body.firstName.trim()
  ) {
    fieldsToUpdate.firstName =
      req.body.firstName.trim();
  }

  if (
    typeof req.body.lastName === "string" &&
    req.body.lastName.trim()
  ) {
    fieldsToUpdate.lastName =
      req.body.lastName.trim();
  }

  if (
    typeof req.body.email === "string" &&
    req.body.email.trim()
  ) {
    fieldsToUpdate.email =
      req.body.email.trim().toLowerCase();
  }

  try {
    const user =
      await User.findByIdAndUpdate(
        req.user.id,
        fieldsToUpdate,
        {
          new: true,
          runValidators: true,
        }
      ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: user,
    });
  } catch (error) {
    console.error(
      "[AUTH][UPDATE_PROFILE]",
      error
    );

    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};