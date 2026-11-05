// 運営への通知。通報と、危機的な言葉（要確認）が届いたらメールで知らせる。
// メールには言葉そのものを入れない。読むのはアプリの運営画面だけにする。
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const nodemailer = require("nodemailer");

const OPERATOR_EMAIL = "myriel.jp@gmail.com";
const gmailPassword = defineSecret("GMAIL_APP_PASSWORD");

// Firestore が米国（nam5）にあるので us-central1 で動かす
const options = { region: "us-central1", secrets: [gmailPassword], maxInstances: 2 };

function notify(subject, text) {
  const mail = nodemailer.createTransport({
    service: "gmail",
    auth: { user: OPERATOR_EMAIL, pass: gmailPassword.value() },
  });
  return mail.sendMail({ from: `吃音村カフェ <${OPERATOR_EMAIL}>`, to: OPERATOR_EMAIL, subject, text });
}

exports.notifyReport = onDocumentCreated({ ...options, document: "reports/{reportId}" }, async () => {
  await notify(
    "【吃音村カフェ】通報が届きました",
    "カフェの言葉に通報が届きました。\n24時間以内に、アプリの「設定」→「運営：カフェの言葉の確認」→「通報」で確認してください。",
  );
});

exports.notifyReview = onDocumentCreated({ ...options, document: "cafeAnswers/{answerId}" }, async (event) => {
  if (event.data?.get("status") !== "review") return;
  await notify(
    "【吃音村カフェ】要確認の言葉が届きました",
    "危機的な言葉を含むカフェの言葉が保存されました。ほかの村人には届いていません。\nアプリの「設定」→「運営：カフェの言葉の確認」→「要確認」で確認してください。",
  );
});
