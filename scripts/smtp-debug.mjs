import { createRequire } from "module";
import { readFileSync } from "fs";
const require = createRequire(import.meta.url);
const nodemailer = require("nodemailer");

const env = Object.fromEntries(
  readFileSync(".env.local", "utf-8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);

const tx = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: 465,
  secure: true,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  logger: true,
  debug: true,
});

try {
  const info = await tx.sendMail({
    from: env.SMTP_FROM,
    to: process.argv[2] || "leon@enpassent.co.zw",
    subject: "Delivery test",
    text: "test",
  });
  console.log("RESULT:", info.response, info.messageId);
} catch (e) {
  console.log("ERR:", e.message);
}
process.exit(0);
