import Signer from '../index.js';

async function testSignerDirectly() {
  console.log("🚀 Testing Signer directly (not via server)");

  const signer = new Signer();

  try {
    console.log("⏳ Initializing signer...");
    await signer.init();
    console.log("✅ Signer initialized successfully");

    const testUrl = 'https://m.tiktok.com/api/post/item_list/?aid=1988&count=5';
    console.log(`🔗 Testing URL: ${testUrl}`);

    console.log("✍️ Generating signature...");
    const signature = await signer.sign(testUrl);
    console.log("✅ Signature generated successfully!");

    console.log("📋 Results:");
    console.log(`   Signature: ${signature.signature.substring(0, 20)}...`);
    console.log(`   Verify FP: ${signature.verify_fp.substring(0, 20)}...`);
    console.log(`   X-Bogus: ${signature['x-bogus'].substring(0, 20)}...`);
    console.log(`   X-Gnarly: ${signature['x-gnarly'] ? signature['x-gnarly'].substring(0, 20) + '...' : 'Not generated'}`);
    console.log(`   X-TT-Params: ${signature['x-tt-params'].substring(0, 20)}...`);
    console.log(`   Device ID: ${signature['device-id']}`);
    console.log(`   Timestamp: ${signature.timestamp}`);

    const navigator = await signer.navigator();
    console.log("🧭 Navigator info collected");
    console.log(`   User Agent: ${navigator.user_agent.substring(0, 50)}...`);

    return { signature, navigator };
  } catch (error) {
    console.error("❌ Error:", error.message);
    throw error;
  } finally {
    console.log("🔒 Closing signer...");
    await signer.close();
    console.log("✅ Signer closed");
  }
}

// Run the test
testSignerDirectly()
  .then(() => {
    console.log("\n✅ Direct signer test completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Direct signer test failed:", error.message);
    process.exit(1);
  });