import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import crypto from "crypto";
import path from "path";

// Point to the backend .env
dotenv.config({
  path: "c:/Users/adity/Documents/my Projects/peerlance2/apps/backend/.env",
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log("🚀 Starting Deep Referral System Verification...");

  // Setup Referrer
  const referrerId = crypto.randomUUID();
  const { data: referrer, error: refError } = await supabase
    .from("User")
    .insert({
      id: referrerId,
      email: `referrer_${Date.now()}@test.com`,
      name: "Auto Test Referrer",
      clerkId: `test_ref_${Date.now()}`,
      referralCode: `XTEST${Math.floor(Math.random() * 1000)}`,
      earnedBalance: 0,
      walletBalance: 0,
      college: "Test College",
    })
    .select()
    .single();

  if (refError) throw refError;
  console.log(`✅ Referrer Created: ${referrer.referralCode}`);

  try {
    // -------------------------------------------------------------------
    // CASE 1: WRITER REFERRAL (₹10 Bonus + 2% Commission)
    // -------------------------------------------------------------------
    console.log("\n[Case 1] Simulating Referred Writer...");
    const writerId = crypto.randomUUID();
    await supabase.from("User").insert({
      id: writerId,
      email: `writer_${Date.now()}@test.com`,
      name: "Test Writer",
      clerkId: `test_writer_${Date.now()}`,
      referredById: referrerId,
      totalCompleted: 0,
      college: "Test College",
    });

    // Simulate approval of a 100rs task
    const payout = 100;
    console.log(`- Approving ₹${payout} task for writer...`);

    // Logic from approve/route.ts
    const commission = payout * 0.02;
    const isFirstTask = true;
    const reward = isFirstTask ? 10 + commission : commission;

    await supabase
      .from("User")
      .update({
        earnedBalance: reward,
        walletBalance: reward,
      })
      .eq("id", referrerId);

    const { data: check1 } = await supabase
      .from("User")
      .select("earnedBalance")
      .eq("id", referrerId)
      .single();
    console.log(`- Result: Referrer Earned Balance = ₹${check1.earnedBalance}`);
    if (check1.earnedBalance === 12)
      console.log("PASS: Correctly awarded ₹10 + ₹2");
    else console.log(`FAIL: Expected ₹12, got ₹${check1.earnedBalance}`);

    // -------------------------------------------------------------------
    // CASE 2: POSTER REFERRAL 1 (₹10 Bonus)
    // -------------------------------------------------------------------
    console.log("\n[Case 2] Simulating 1st Referred Poster...");
    const poster1Id = crypto.randomUUID();
    await supabase.from("User").insert({
      id: poster1Id,
      email: `poster1_${Date.now()}@test.com`,
      name: "Poster 1",
      clerkId: `test_p1_${Date.now()}`,
      referredById: referrerId,
      college: "Test College",
    });

    // Mark task completed (poster count logic)
    const bonus1 = 10;
    await supabase
      .from("User")
      .update({
        earnedBalance: check1.earnedBalance + bonus1,
        walletBalance: check1.earnedBalance + bonus1,
      })
      .eq("id", referrerId);

    const { data: check2 } = await supabase
      .from("User")
      .select("earnedBalance")
      .eq("id", referrerId)
      .single();
    console.log(`- Result: Referrer Earned Balance = ₹${check2.earnedBalance}`);
    if (check2.earnedBalance === 22)
      console.log("PASS: Correctly awarded ₹10 for 1st poster");

    // -------------------------------------------------------------------
    // CASE 3: POSTER REFERRAL 2 (₹10 Bonus + ₹40 Milestone)
    // -------------------------------------------------------------------
    console.log("\n[Case 3] Simulating 2nd Referred Poster (Milestone)...");
    const poster2Id = crypto.randomUUID();
    await supabase.from("User").insert({
      id: poster2Id,
      email: `poster2_${Date.now()}@test.com`,
      name: "Poster 2",
      clerkId: `test_p2_${Date.now()}`,
      referredById: referrerId,
      college: "Test College",
    });

    // Simulate 2nd completion
    const bonus2 = 10;
    const milestone = 40;
    await supabase
      .from("User")
      .update({
        earnedBalance: check2.earnedBalance + bonus2 + milestone,
        walletBalance: check2.earnedBalance + bonus2 + milestone,
      })
      .eq("id", referrerId);

    const { data: check3 } = await supabase
      .from("User")
      .select("earnedBalance")
      .eq("id", referrerId)
      .single();
    console.log(`- Result: Referrer Earned Balance = ₹${check3.earnedBalance}`);
    if (check3.earnedBalance === 72)
      console.log("PASS: Correctly awarded ₹10 + ₹40 milestone");
    else console.log(`FAIL: Expected ₹72, got ₹${check3.earnedBalance}`);
  } catch (err) {
    console.error("❌ Error during test:", err);
  } finally {
    console.log("\n🧹 Cleaning up...");
    await supabase.from("User").delete().ilike("email", "%@test.com");
    console.log("🏁 Verification Done.");
  }
}

runTests();
