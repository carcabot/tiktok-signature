/**
 * Basic Signature Example
 *
 * Demonstrates how to generate a signed URL using the signature server.
 *
 * Usage:
 *   1. Start the server: npm start
 *   2. Run this example: node examples/basic-signature.js
 */

const SERVER_URL = "http://localhost:8080";

async function generateSignature() {
  // Build a TikTok API URL
  const secUid =
    "MS4wLjABAAAAtBazTpLuo5XSFwEiX3gkaeV4ZY7u071I08MUNFL5B_zZoelUkTWrhCVvxK7LqAkr";

  const tiktokUrl =
    `https://www.tiktok.com/api/post/item_list/?` +
    `aid=1988&app_name=tiktok_web&device_platform=web_pc&` +
    `secUid=${encodeURIComponent(secUid)}&cursor=0&count=30`;

  console.log("Requesting signature for URL...");
  console.log("TikTok URL:", tiktokUrl.substring(0, 80) + "...");

  // Request signature from server
  const response = await fetch(`${SERVER_URL}/signature`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: tiktokUrl }),
  });

  const result = await response.json();

  if (result.status !== "ok") {
    throw new Error(result.message || "Signature generation failed");
  }

  console.log("\nSignature generated successfully!");
  console.log("X-Bogus:", result.data["x-bogus"]);
  console.log("X-Gnarly:", result.data["x-gnarly"]?.substring(0, 40) + "...");
  console.log(
    "User-Agent:",
    result.data.navigator.user_agent.substring(0, 60) + "...",
  );
  console.log(
    "\nSigned URL:",
    result.data.signed_url.substring(0, 100) + "...",
  );

  return result.data;
}

// Run the example
generateSignature()
  .then(() => {
    console.log("\nExample completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nError:", error.message);
    process.exit(1);
  });
