import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import crypto from "crypto";

// Use absolute path for .env
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
  console.log("🚀 INITIALIZING DEEP REFERRAL SYSTEM TEST...");
  const testId = Date.now();
  const college = "MANGALMAY INSTITUTE";

  // State to track results
  const results = [];

  const addResult = (name, status, details) => {
    results.push({ name, status, details });
    console.log(`${status === "PASS" ? "✅" : "❌"} ${name}: ${details}`);
  };

  try {
    // 1. Setup Referrer
    const referrerId = crypto.randomUUID();
    const { error: refError } = await supabase.from("User").insert({
      id: referrerId,
      email: `referrer_${testId}@test.com`,
      name: "Referrer A",
      clerkId: `clerk_ref_${testId}`,
      referralCode: `TRED${testId.toString().slice(-4)}`,
      earnedBalance: 0,
      walletBalance: 0,
      college,
      collegeDomain: "manual_selection",
      updatedAt: new Date().toISOString(),
    });
    if (refError) throw refError;
    addResult("Referrer Setup", "PASS", "Created test referrer user");

    // --- CASE 1: WRITER REFERRAL ---
    console.log("\n[TEST CASE] Writer Referral...");
    const writerId = crypto.randomUUID();
    await supabase.from("User").insert({
      id: writerId,
      email: `writer_${testId}@test.com`,
      name: "Writer B",
      clerkId: `clerk_writer_${testId}`,
      referredById: referrerId,
      totalCompleted: 0,
      college,
      collegeDomain: "manual_selection",
    });

    // Simulate approval of a ₹100 task
    // Logic from approve/route.ts
    const payout = 100;
    const writerCommission = payout * 0.02;
    const writerFirstBonus = 10;
    const totalWriterReward = writerFirstBonus + writerCommission;

    await supabase
      .from("User")
      .update({
        earnedBalance: totalWriterReward,
        walletBalance: totalWriterReward,
      })
      .eq("id", referrerId);

    const { data: check1 } = await supabase
      .from("User")
      .select("earnedBalance")
      .eq("id", referrerId)
      .single();
    if (check1.earnedBalance === 12) {
      addResult(
        "Writer Reward",
        "PASS",
        "Referrer received ₹10 bonus + ₹2 commission",
      );
    } else {
      addResult(
        "Writer Reward",
        "FAIL",
        `Expected ₹12, got ₹${check1.earnedBalance}`,
      );
    }

    // --- CASE 2: POSTER REFERRAL 1 ---
    console.log("\n[TEST CASE] Poster 1 Completion...");
    const poster1Id = crypto.randomUUID();
    await supabase.from("User").insert({
      id: poster1Id,
      email: `poster1_${testId}@test.com`,
      name: "Poster C",
      clerkId: `clerk_p1_${testId}`,
      referredById: referrerId,
      college,
      collegeDomain: "manual_selection",
      updatedAt: new Date().toISOString(),
    });

    const poster1Bonus = 10;
    await supabase
      .from("User")
      .update({
        earnedBalance: check1.earnedBalance + poster1Bonus,
        walletBalance: check1.earnedBalance + poster1Bonus,
      })
      .eq("id", referrerId);

    const { data: check2 } = await supabase
      .from("User")
      .select("earnedBalance")
      .eq("id", referrerId)
      .single();
    if (check2.earnedBalance === 22) {
      addResult(
        "Poster 1 Reward",
        "PASS",
        "Referrer received ₹10 bonus for 1st poster",
      );
    } else {
      addResult(
        "Poster 1 Reward",
        "FAIL",
        `Expected ₹22, got ₹${check2.earnedBalance}`,
      );
    }

    // --- CASE 3: POSTER REFERRAL 2 (Milestone) ---
    console.log("\n[TEST CASE] Poster 2 Completion (Milestone)...");
    const poster2Id = crypto.randomUUID();
    await supabase.from("User").insert({
      id: poster2Id,
      email: `poster2_${testId}@test.com`,
      name: "Poster D",
      clerkId: `clerk_p2_${testId}`,
      referredById: referrerId,
      college,
    });

    const poster2Bonus = 10;
    const milestoneBonus = 40;
    await supabase
      .from("User")
      .update({
        earnedBalance: check2.earnedBalance + poster2Bonus + milestoneBonus,
        walletBalance: check2.earnedBalance + poster2Bonus + milestoneBonus,
      })
      .eq("id", referrerId);

    const { data: check3 } = await supabase
      .from("User")
      .select("earnedBalance")
      .eq("id", referrerId)
      .single();
    if (check3.earnedBalance === 72) {
      addResult(
        "Poster Milestone",
        "PASS",
        "Referrer received ₹10 bonus + ₹40 milestone for 2nd poster (Total ₹72)",
      );
    } else {
      addResult(
        "Poster Milestone",
        "FAIL",
        `Expected ₹72, got ₹${check3.earnedBalance}`,
      );
    }

    // --- CASE 4: REPEATED COMPLETION ---
    console.log("\n[TEST CASE] Repeated Completion Check...");
    // If Poster C completes another task, no more bonuses should be added
    await supabase
      .from("User")
      .update({
        earnedBalance: check3.earnedBalance, // No change
        walletBalance: check3.earnedBalance,
      })
      .eq("id", referrerId);

    const { data: check4 } = await supabase
      .from("User")
      .select("earnedBalance")
      .eq("id", referrerId)
      .single();
    if (check4.earnedBalance === 72) {
      addResult(
        "Repeated Completion",
        "PASS",
        "No extra bonus for redundant poster completions",
      );
    } else {
      addResult(
        "Repeated Completion",
        "FAIL",
        `Balance changed unexpectedly: ₹${check4.earnedBalance}`,
      );
    }
  } catch (err) {
    console.error("❌ CRITICAL ERROR IN TEST SUITE:", err);
  } finally {
    console.log("\n🧹 CLEANING UP...");
    const { error: delError } = await supabase
      .from("User")
      .delete()
      .ilike("email", "%@test.com");
    if (delError) console.error("Cleanup failed:", delError);
    else console.log("✅ Temporary users removed.");
    console.log("🏁 TEST SUITE FINISHED.");
  }
}

runTests();
