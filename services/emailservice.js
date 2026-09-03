const { Resend } = require("resend");

/*
|--------------------------------------------------------------------------
| SankofaSeek Email Service
|--------------------------------------------------------------------------
| Resend is configured with the verified domain:
|
| support.sankofaseek.com
|
| Therefore all sender addresses used here belong to that domain.
|
| Required environment variable:
|
| RESEND_API_KEY=re_xxxxxxxxx
|--------------------------------------------------------------------------
*/

const VERIFIED_EMAIL_DOMAIN = "support.sankofaseek.com";

const senderAddresses = {
  hello: `hello@${VERIFIED_EMAIL_DOMAIN}`,
  info: `info@${VERIFIED_EMAIL_DOMAIN}`,
  library: `library@${VERIFIED_EMAIL_DOMAIN}`,
  support: `support@${VERIFIED_EMAIL_DOMAIN}`,
};

const getSender = (type = "hello") => {
  const email = senderAddresses[type];

  if (!email) {
    throw new Error(`Unknown email sender type: ${type}`);
  }

  return `SankofaSeek <${email}>`;
};

/*
|--------------------------------------------------------------------------
| Resend Client
|--------------------------------------------------------------------------
*/

const getResend = () => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  return new Resend(process.env.RESEND_API_KEY);
};

/*
|--------------------------------------------------------------------------
| Base Platform URL
|--------------------------------------------------------------------------
*/

const platformUrl = () => {
  return (
    process.env.PLATFORM_URL ||
    process.env.FRONTEND_URL ||
    "https://sankofaseek.com"
  );
};

/*
|--------------------------------------------------------------------------
| Shared Email Styles
|--------------------------------------------------------------------------
*/

const emailLayout = ({
  title,
  content,
  footer = "The SankofaSeek Team",
}) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
        <title>${title}</title>
      </head>

      <body style="
        margin: 0;
        padding: 0;
        background-color: #f6f7f9;
        font-family: Arial, Helvetica, sans-serif;
        color: #1f2937;
      ">

        <table
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="padding: 40px 16px;"
        >
          <tr>
            <td align="center">

              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="
                  max-width: 560px;
                  background-color: #ffffff;
                  border-radius: 12px;
                  overflow: hidden;
                "
              >

                <!-- Header -->
                <tr>
                  <td style="
                    padding: 30px 32px;
                    text-align: center;
                    border-bottom: 1px solid #eeeeee;
                  ">
                    <h1 style="
                      margin: 0;
                      font-size: 28px;
                      color: #111827;
                      font-weight: 700;
                    ">
                      SankofaSeek
                    </h1>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="
                    padding: 40px 32px;
                  ">
                    ${content}
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="
                    padding: 24px 32px;
                    background-color: #f9fafb;
                    text-align: center;
                  ">
                    <p style="
                      margin: 0;
                      font-size: 13px;
                      color: #9ca3af;
                    ">
                      ${footer}
                    </p>

                    <p style="
                      margin: 8px 0 0;
                      font-size: 12px;
                      color: #b0b7c3;
                    ">
                      © ${new Date().getFullYear()} SankofaSeek.
                      All rights reserved.
                    </p>
                  </td>
                </tr>

              </table>

            </td>
          </tr>
        </table>

      </body>
    </html>
  `;
};

/*
|--------------------------------------------------------------------------
| Email Templates
|--------------------------------------------------------------------------
*/

const templates = {
  /*
  |--------------------------------------------------------------------------
  | Verification OTP
  |--------------------------------------------------------------------------
  */

  verification: ({ firstName, otp }) => {
    const displayName = firstName || "there";

    return {
      subject: "Verify your SankofaSeek account",

      html: emailLayout({
        title: "Verify your SankofaSeek account",

        content: `
          <h2 style="
            margin: 0 0 16px;
            font-size: 22px;
            color: #111827;
          ">
            Verify your email
          </h2>

          <p style="
            margin: 0 0 16px;
            font-size: 16px;
            line-height: 1.6;
          ">
            Hi ${displayName},
          </p>

          <p style="
            margin: 0 0 24px;
            font-size: 16px;
            line-height: 1.6;
            color: #4b5563;
          ">
            Welcome to SankofaSeek! To complete your registration,
            please enter the verification code below in the app.
          </p>

          <div style="
            margin: 30px 0;
            text-align: center;
          ">
            <div style="
              display: inline-block;
              padding: 18px 28px;
              background-color: #f3f4f6;
              border-radius: 10px;
              font-size: 32px;
              font-weight: 700;
              letter-spacing: 8px;
              color: #111827;
            ">
              ${otp}
            </div>
          </div>

          <p style="
            margin: 0;
            text-align: center;
            font-size: 14px;
            color: #6b7280;
          ">
            This code will expire in
            <strong>10 minutes</strong>.
          </p>

          <p style="
            margin: 28px 0 0;
            font-size: 14px;
            line-height: 1.6;
            color: #6b7280;
          ">
            If you did not create a SankofaSeek account,
            you can safely ignore this email.
          </p>

          <p style="
            margin: 16px 0 0;
            font-size: 14px;
            line-height: 1.6;
            color: #6b7280;
          ">
            For your security, never share this verification
            code with anyone.
          </p>
        `,

      }),

      text: `
Hi ${displayName},

Welcome to SankofaSeek!

Your email verification code is:

${otp}

This code will expire in 10 minutes.

If you did not create a SankofaSeek account, you can safely ignore this email.

For your security, never share this verification code with anyone.

The SankofaSeek Team
      `.trim(),
    };
  },

  /*
  |--------------------------------------------------------------------------
  | Welcome Email
  |--------------------------------------------------------------------------
  */


welcome: ({ firstName }) => {
  const displayName = firstName || "there";

  return {
    subject: "Welcome to SankofaSeek",
    html: emailLayout({
      title: "Welcome to SankofaSeek",
      content: `
        <h2>Welcome to SankofaSeek 🎉</h2>

        <p>Hi ${displayName},</p>

        <p>
          Welcome to SankofaSeek. Your account has been created successfully,
          and you have taken your first step into a space built for discovery,
          learning, creativity, and deeper connection with African knowledge
          and ideas.
        </p>

        <p>
          Your SankofaSeek account gives you access to your personal library,
          purchased materials, and the experiences we continue to build on
          the platform.
        </p>

        <p>
          Your journey starts here. Explore the platform, discover something
          meaningful, and return whenever you are ready to continue your journey.
        </p>

        <div style="text-align:center;margin:30px 0;">
          <a
            href="${platformUrl()}"
            style="
              display:inline-block;
              padding:14px 24px;
              background-color:#111827;
              color:#ffffff;
              text-decoration:none;
              border-radius:8px;
              font-size:15px;
              font-weight:600;
            "
          >
            Visit SankofaSeek
          </a>
        </div>

        <p style="text-align:center;font-size:14px;color:#6b7280;">
          <a
            href="${platformUrl()}"
            style="color:#111827;text-decoration:none;"
          >
            ${platformUrl()}
          </a>
        </p>

        <p>
          Thank you for choosing to seek, discover, and learn with us.
        </p>

        <p>
          <strong>Keep seeking. Keep discovering.</strong>
        </p>
      `,
    }),

    text: `Hi ${displayName},

Welcome to SankofaSeek.

Your account has been created successfully, and you have taken your first step into a space built for discovery, learning, creativity, and deeper connection with African knowledge and ideas.

Your SankofaSeek account gives you access to your personal library, purchased materials, and the experiences we continue to build on the platform.

Your journey starts here. Explore the platform, discover something meaningful, and return whenever you are ready to continue your journey.

Visit SankofaSeek:
${platformUrl()}

Thank you for choosing to seek, discover, and learn with us.

Keep seeking. Keep discovering.

The SankofaSeek Team`.trim(),
  };
},





  passwordReset: ({ firstName, resetLink, expirationTime = "1 hour" }) => {
    const displayName = firstName || "there";

    return {
      subject: "Reset your SankofaSeek password",

      html: emailLayout({
        title: "Reset your password",

        content: `
          <h2 style="
            margin: 0 0 16px;
            font-size: 22px;
            color: #111827;
          ">
            Reset your password
          </h2>

          <p style="
            margin: 0 0 16px;
            font-size: 16px;
            line-height: 1.6;
          ">
            Hi ${displayName},
          </p>

          <p style="
            margin: 0 0 24px;
            font-size: 16px;
            line-height: 1.6;
            color: #4b5563;
          ">
            We received a request to reset your SankofaSeek password.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a
              href="${resetLink}"
              style="
                display: inline-block;
                padding: 14px 24px;
                background-color: #111827;
                color: #ffffff;
                text-decoration: none;
                border-radius: 8px;
                font-size: 15px;
                font-weight: 600;
              "
            >
              Reset Password
            </a>
          </div>

          <p style="
            margin: 0;
            font-size: 14px;
            color: #6b7280;
            line-height: 1.6;
          ">
            This link will expire in ${expirationTime}.
          </p>

          <p style="
            margin: 16px 0 0;
            font-size: 14px;
            color: #6b7280;
            line-height: 1.6;
          ">
            If you did not request a password reset,
            you can safely ignore this email.
          </p>
        `,
      }),

      text: `
Hi ${displayName},

We received a request to reset your SankofaSeek password.

Reset your password here:

${resetLink}

This link will expire in ${expirationTime}.

If you did not request a password reset, you can safely ignore this email.

The SankofaSeek Team
      `.trim(),
    };
  },



  purchaseConfirmation: ({
    firstName,
    itemName,
    amount,
    transactionId,
  }) => {
    const displayName = firstName || "there";

    return {
      subject: "Your SankofaSeek purchase was successful",

      html: emailLayout({
        title: "Purchase successful",

        content: `
          <h2 style="
            margin: 0 0 16px;
            font-size: 22px;
            color: #111827;
          ">
            Purchase successful
          </h2>

          <p style="
            margin: 0 0 16px;
            font-size: 16px;
          ">
            Hi ${displayName},
          </p>

          <p style="
            margin: 0 0 24px;
            color: #4b5563;
            line-height: 1.6;
          ">
            Your purchase on SankofaSeek was successful.
          </p>

          <div style="
            padding: 20px;
            background: #f9fafb;
            border-radius: 8px;
          ">
            <p style="margin: 0 0 10px;">
              <strong>Item:</strong> ${itemName || "N/A"}
            </p>

            <p style="margin: 0 0 10px;">
              <strong>Amount:</strong> ${amount || "N/A"}
            </p>

            <p style="margin: 0;">
              <strong>Transaction ID:</strong> ${transactionId || "N/A"}
            </p>
          </div>
        `,
      }),

      text: `
Hi ${displayName},

Your purchase on SankofaSeek was successful.

Item: ${itemName || "N/A"}
Amount: ${amount || "N/A"}
Transaction ID: ${transactionId || "N/A"}

The SankofaSeek Team
      `.trim(),
    };
  },



  libraryAccess: ({ firstName, itemName }) => {
    const displayName = firstName || "there";

    return {
      subject: "Your SankofaSeek library has been updated",

      html: emailLayout({
        title: "Library updated",

        content: `
          <h2 style="
            margin: 0 0 16px;
            font-size: 22px;
            color: #111827;
          ">
            Added to your library
          </h2>

          <p style="
            margin: 0 0 16px;
            font-size: 16px;
          ">
            Hi ${displayName},
          </p>

          <p style="
            margin: 0;
            font-size: 16px;
            line-height: 1.6;
            color: #4b5563;
          ">
            <strong>${itemName || "Your purchased content"}</strong>
            is now available in your SankofaSeek library.
          </p>
        `,
      }),

      text: `
Hi ${displayName},

${itemName || "Your purchased content"} is now available in your SankofaSeek library.

The SankofaSeek Team
      `.trim(),
    };
  },



  paymentFailed: ({ firstName, itemName, amount }) => {
    const displayName = firstName || "there";

    return {
      subject: "SankofaSeek payment failed",

      html: emailLayout({
        title: "Payment failed",

        content: `
          <h2 style="
            margin: 0 0 16px;
            font-size: 22px;
            color: #111827;
          ">
            Payment unsuccessful
          </h2>

          <p style="
            margin: 0 0 16px;
            font-size: 16px;
          ">
            Hi ${displayName},
          </p>

          <p style="
            margin: 0 0 20px;
            color: #4b5563;
            line-height: 1.6;
          ">
            Unfortunately, your recent payment could not be completed.
          </p>

          <div style="
            padding: 20px;
            background: #f9fafb;
            border-radius: 8px;
          ">
            <p style="margin: 0 0 10px;">
              <strong>Item:</strong> ${itemName || "N/A"}
            </p>

            <p style="margin: 0;">
              <strong>Amount:</strong> ${amount || "N/A"}
            </p>
          </div>

          <p style="
            margin: 20px 0 0;
            color: #6b7280;
            line-height: 1.6;
          ">
            Please try again or use another payment method.
          </p>
        `,
      }),

      text: `
Hi ${displayName},

Unfortunately, your recent payment could not be completed.

Item: ${itemName || "N/A"}
Amount: ${amount || "N/A"}

Please try again or use another payment method.

The SankofaSeek Team
      `.trim(),
    };
  },



  refundConfirmation: ({ firstName, itemName, amount }) => {
    const displayName = firstName || "there";

    return {
      subject: "Your SankofaSeek refund has been processed",

      html: emailLayout({
        title: "Refund processed",

        content: `
          <h2 style="
            margin: 0 0 16px;
            font-size: 22px;
            color: #111827;
          ">
            Refund processed
          </h2>

          <p style="
            margin: 0 0 16px;
            font-size: 16px;
          ">
            Hi ${displayName},
          </p>

          <p style="
            margin: 0 0 20px;
            color: #4b5563;
            line-height: 1.6;
          ">
            Your refund has been processed successfully.
          </p>

          <div style="
            padding: 20px;
            background: #f9fafb;
            border-radius: 8px;
          ">
            <p style="margin: 0 0 10px;">
              <strong>Item:</strong> ${itemName || "N/A"}
            </p>

            <p style="margin: 0;">
              <strong>Refund amount:</strong> ${amount || "N/A"}
            </p>
          </div>
        `,
      }),

      text: `
Hi ${displayName},

Your refund has been processed successfully.

Item: ${itemName || "N/A"}
Refund amount: ${amount || "N/A"}

The SankofaSeek Team
      `.trim(),
    };
  },



  supportConfirmation: ({ firstName, subject }) => {
    const displayName = firstName || "there";

    return {
      subject: "We received your SankofaSeek support request",

      html: emailLayout({
        title: "Support request received",

        content: `
          <h2 style="
            margin: 0 0 16px;
            font-size: 22px;
            color: #111827;
          ">
            We've received your message
          </h2>

          <p style="
            margin: 0 0 16px;
            font-size: 16px;
          ">
            Hi ${displayName},
          </p>

          <p style="
            margin: 0;
            color: #4b5563;
            line-height: 1.6;
          ">
            Thank you for contacting SankofaSeek support.
            Our team has received your request and will get back
            to you as soon as possible.
          </p>

          ${
            subject
              ? `
                <div style="
                  margin-top: 24px;
                  padding: 16px;
                  background: #f9fafb;
                  border-radius: 8px;
                ">
                  <strong>Subject:</strong> ${subject}
                </div>
              `
              : ""
          }
        `,
      }),

      text: `
Hi ${displayName},

Thank you for contacting SankofaSeek support.

We've received your request and will get back to you as soon as possible.

${subject ? `Subject: ${subject}` : ""}

The SankofaSeek Team
      `.trim(),
    };
  },



  newRelease: ({ firstName, title, description }) => {
    const displayName = firstName || "there";

    return {
      subject: `New on SankofaSeek: ${title || "New Release"}`,

      html: emailLayout({
        title: "New release",

        content: `
          <h2 style="
            margin: 0 0 16px;
            font-size: 22px;
            color: #111827;
          ">
            Something new is waiting for you
          </h2>

          <p style="
            margin: 0 0 16px;
            font-size: 16px;
          ">
            Hi ${displayName},
          </p>

          <h3 style="
            margin: 0 0 12px;
            font-size: 20px;
            color: #111827;
          ">
            ${title || "New Release"}
          </h3>

          <p style="
            margin: 0;
            color: #4b5563;
            line-height: 1.6;
          ">
            ${description || "Check out the latest content on SankofaSeek."}
          </p>
        `,
      }),

      text: `
Hi ${displayName},

Something new is waiting for you on SankofaSeek.

${title || "New Release"}

${description || "Check out the latest content on SankofaSeek."}

The SankofaSeek Team
      `.trim(),
    };
  },



  feedbackRequest: ({ firstName, message }) => {
    const displayName = firstName || "there";

    return {
      subject: "We'd love your feedback — SankofaSeek",

      html: emailLayout({
        title: "We'd love your feedback",

        content: `
          <h2 style="
            margin: 0 0 16px;
            font-size: 22px;
            color: #111827;
          ">
            We'd love your feedback
          </h2>

          <p style="
            margin: 0 0 16px;
            font-size: 16px;
          ">
            Hi ${displayName},
          </p>

          <p style="
            margin: 0;
            color: #4b5563;
            line-height: 1.6;
          ">
            ${message || "Your feedback helps us make SankofaSeek better."}
          </p>
        `,
      }),

      text: `
Hi ${displayName},

${message || "Your feedback helps us make SankofaSeek better."}

The SankofaSeek Team
      `.trim(),
    };
  },
};



const sendEmail = async ({
  to,
  subject,
  html,
  text,
  senderKind = "hello",
}) => {
  if (!to) {
    throw new Error("Email recipient is required");
  }

  if (!subject) {
    throw new Error("Email subject is required");
  }

  const resend = getResend();

  const result = await resend.emails.send({
    from: getSender(senderKind),
    to,
    subject,
    html,
    text,
  });

  if (result.error) {
    throw new Error(
      result.error.message || "Resend failed to send email"
    );
  }

  return result;
};


const sendTemplate = async (kind, variables = {}) => {
  const template = templates[kind];

  if (!template) {
    throw new Error(`Unknown email template: ${kind}`);
  }

  const email = template(variables);

  let senderKind = "hello";

  if (
    kind === "supportConfirmation" ||
    kind === "passwordReset"
  ) {
    senderKind = "support";
  }

  if (
    kind === "purchaseConfirmation" ||
    kind === "libraryAccess"
  ) {
    senderKind = "library";
  }

  return sendEmail({
    to: variables.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    senderKind,
  });
};


module.exports = {
  sendEmail,
  sendTemplate,
  platformUrl,
  getSender,
};