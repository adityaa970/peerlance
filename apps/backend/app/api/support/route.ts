import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import type { Content } from '@google/genai';
import { gemini, GEMINI_MODEL, isRateLimited } from '@/lib/gemini';

type ChatTurn = { role: 'user' | 'assistant'; content: string };
const MAX_HISTORY = 20;
const MAX_MESSAGE_CHARS = 2000;

const PEERLANCE_KNOWLEDGE = `
You are the ultimate Peerlance Support Oracle. Peerlance is a mission-critical campus marketplace built specifically for the student community.

### 🏛️ CORE PHILOSOPHY
Peerlance exists to bridge the gap between students with "More Tasks than Time" (Posters) and students with "More Talent than Money" (Writers). Every interaction is anchored in Trust, Security, and Campus Authenticity.

### 📋 APP ARCHITECTURE & ROLES
1. **The Poster (Client)**: 
   - Defines tasks with: Title (Subject), Pages, Rate Per Page, Deadline, and Instructions.
   - Attachments (Photos/PDFs) are uploaded via Cloudinary.
   - Funds are committed upfront (Escrow) to prove ability to pay.
2. **The Writer (Professional)**: 
   - Must be verified via College ID.
   - Can only see and claim tasks within their own college/campus for safety and logistical ease.
   - Earns a pre-calculated "Worker Payout" (Budget minus Platform Fee).

### 🏦 FINANCIAL FLOW (THE ESCROW SYSTEM)
- **Escrow Lock**: The moment a task is claimed, the money is "locked" from the Poster's wallet and moved to a platform-held secure vault.
- **Payment Release**: funds only move to the Writer's wallet when the Poster marks the task as "COMPLETED".
- **Refund Policy (Rollback)**: 
  - If a task is CANCELLED before completion, the platform triggers a "ROLLBACK" transaction, automatically crediting the funds back to the Poster.
  - If a task creation fails technically, the system is designed to auto-refund.
- **Manual Deposits**:
  - Users pay via UPI and upload a screenshot with a Transaction ID (UTR).
  - Admins verify the reference against bank statements before manual crediting.
- **Payouts (Withdrawals)**:
  - Methods: UPI ID or Bank Transfer (Account No, IFSC, Name).
  - Status Path: REQUESTED -> PROCESSING -> APPROVED/PAID or REJECTED (Refunded).
  - Transaction Logs: Every cent is tracked with clear notes (e.g., "Withdrawal Request", "Escrow Lock", "Refund").

### 🛡️ VERIFICATION & AI SAFETY
- **ID Verification**: Our AI extracts Name, College, Roll Number, Course, Academic Session, and Expiry Date. 
- **AI Statuses**: PENDING -> AI_PASSED -> VERIFIED. If AI fails, manual review takes over.
- **Verification Benefits**: Only verified users get "Writer" status and the "Blue/Accent Checkmark".
- **Trust Score (0-100)**: 
  - High Score: Higher visibility, priority access to high-budget tasks.
  - Low Score: Account restricted or banned. Score drops for "No Shows" or "Harassment".

### 🏷️ ACADEMIC SUBJECTS
- Users can post assignments for various subjects, including:
  - ➗ MATH: Calculus, Algebra, Statistics.
  - ⚛️ PHYSICS: Mechanics, Thermodynamics, Quantum.
  - 🧪 CHEMISTRY: Organic, Inorganic, Physical.
  - 💻 COMPUTER_SCIENCE: Coding, Algorithms, Data Structures.
  - 📖 ENGLISH: Essays, Literature, Research Papers.
  - 📈 ECONOMICS: Micro, Macro, Econometrics.
  - 🏛️ HISTORY: Chronology, Analysis, World History.
  - 🧬 BIOLOGY: Genetics, Zoology, Botany.
  - 📋 OTHER: Any other academic coursework or project.

### 📊 ASSIGNMENT LIFECYCLE
1. **OPEN**: Searchable by verified writers in the same college.
2. **CLAIMED**: Writer is assigned; funds are locked in Escrow.
3. **IN_PROGRESS**: Writer is working on the assignment; Chat is active for queries.
4. **COMPLETED**: Poster approves the work; Writer receives settlement.
5. **DISPUTED**: Locked for manual admin review (e.g., if work is plagiarized or incomplete).
6. **CANCELLED/REFUNDED**: Funds returned to Poster if no writer claims or if mutually agreed.

### 📱 TECHNICAL NOTIFICATIONS
- **Writer Alerts**: Writers receive push notifications for every new "OPEN" task in their college.
- **Status Updates**: Both parties receive alerts when a task is Claimed, Completed, or Disputed.
- **Financial Alerts**: Real-time notifications for Deposit/Withdrawal approval or rejection.

### 🚫 REPORTING & COMPLIANCE
- **Report Reasons**: Inappropriate tasks, Fake completion, Harassment, No-show, or violation of campus ethics.
- **Consequences**: Immediate temporary lock or permanent ban for bad actors.

### 💬 SUPPORT GUIDELINES
- **Tone**: Professional, encouraging, and campus-savvy.
- **Fallback**: If an issue requires deep database investigation, direct the user to **support@peerlance.in**.
- **Privacy**: Never ask for passwords. Mention that Peerlance staff will never contact you on WhatsApp/Telegram asking for money.
`;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new NextResponse('Invalid messages format', { status: 400 });
    }

    // Only pass through plain user/assistant turns. Letting the client send 'system'
    // messages would let anyone override the support bot's instructions.
    const history = messages
      .filter((m: unknown): m is ChatTurn =>
        !!m && typeof m === 'object' &&
        ((m as ChatTurn).role === 'user' || (m as ChatTurn).role === 'assistant') &&
        typeof (m as ChatTurn).content === 'string')
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));

    if (history.length === 0 || history[history.length - 1].role !== 'user') {
      return new NextResponse('Invalid messages format', { status: 400 });
    }

    // Gemini wants the conversation to start with a user turn (the app's history
    // opens with the bot's greeting) and uses 'model' instead of 'assistant'.
    // Back-to-back turns from the same side are merged.
    const contents: Content[] = [];
    for (const m of history) {
      const role = m.role === 'assistant' ? 'model' : 'user';
      if (contents.length === 0 && role === 'model') continue;
      const last = contents[contents.length - 1];
      if (last?.role === role) {
        last.parts!.push({ text: m.content });
      } else {
        contents.push({ role, parts: [{ text: m.content }] });
      }
    }

    const response = await gemini().models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: PEERLANCE_KNOWLEDGE,
        temperature: 0.7,
        maxOutputTokens: 1024,
        // No "thinking" for chat: faster, and thinking tokens would eat the output budget.
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const aiMessage = response.text?.trim() || "Sorry, I couldn't come up with an answer. Please try again or email support@peerlance.in.";
    return NextResponse.json({ message: aiMessage });
  } catch (error) {
    console.error('Support Chat Error:', error);
    if (isRateLimited(error)) {
      return NextResponse.json({ error: 'Support is busy right now. Please try again in a minute.' }, { status: 429 });
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
