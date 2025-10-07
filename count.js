/**
 * count_premium.js
 *
 * Usage:
 *   node count_premium.js <target>
 * Example:
 *   node count_premium.js @mygroupname
 *   node count_premium.js https://t.me/joinchat/AAAAA...
 *
 * Required env vars:
 *   TG_API_ID   - from https://my.telegram.org
 *   TG_API_HASH - from https://my.telegram.org
 */

const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const fs = require("fs");

const apiId = parseInt(process.env.TG_API_ID || "20406697", 10);
const apiHash = process.env.TG_API_HASH || "237daf05a85d6ebf0f5af503e1cb1858";
const SESSION_FILE = "./session.string";

// read stored session if exists
let stringSession = "";
if (fs.existsSync(SESSION_FILE)) {
  stringSession = fs.readFileSync(SESSION_FILE, "utf8").trim();
}

async function main() {
  const client = new TelegramClient(
    new StringSession(stringSession),
    apiId,
    apiHash,
    { connectionRetries: 5 }
  );

  // connect / auth
  await client.start({
    phoneNumber: async () =>
      await input.text("Please enter your phone number (international format): "),
    password: async () => await input.text("Please enter your 2FA password (if set): "),
    phoneCode: async () => await input.text("Enter the code you received: "),
    onError: (err) => console.log("Auth error:", err),
  });

  // save session string
  const newSession = client.session.save();
  fs.writeFileSync(SESSION_FILE, newSession, "utf8");
  console.log("Session saved to", SESSION_FILE);

  // target from argv
  const target = process.argv[2];
  if (!target) {
    console.error("Usage: node count_premium.js <target>");
    process.exit(1);
  }

  try {
    const entity = await client.getEntity(target);
    console.log("Resolved entity:", entity.id.toString());

    let usersSeen = 0;
    let premiumCount = 0;

    console.log("Fetching participants (this may take time)...");

    // iterParticipants avtomatik sahifalab beradi
    for await (const user of client.iterParticipants(entity)) {
      usersSeen += 1;

      const isPremium = !!(
        user.is_premium ||
        user.isPremium ||
        user.premium
      );

      if (isPremium) premiumCount += 1;

      if (usersSeen % 500 === 0) {
        console.log(`Fetched: ${usersSeen}, Premium so far: ${premiumCount}`);
      }
    }

    console.log("--- Results ---");
    console.log("Fetched members:", usersSeen);
    console.log("Premium members (fetched):", premiumCount);
    console.log(
      "Premium % (fetched):",
      usersSeen ? ((premiumCount / usersSeen) * 100).toFixed(2) + "%" : "0%"
    );
  } finally {
    await client.disconnect();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
