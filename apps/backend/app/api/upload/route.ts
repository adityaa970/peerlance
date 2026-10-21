import { v2 as cloudinary } from 'cloudinary';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// Requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in env

const ALLOWED_FOLDER = 'peerlance';
const MAX_CLOCK_SKEW_SECONDS = 60 * 60;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.CLOUDINARY_API_SECRET) {
      return new NextResponse("Cloudinary secret not configured", { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const timestamp = Number(body?.paramsToSign?.timestamp);
    const now = Math.round(Date.now() / 1000);

    if (!Number.isInteger(timestamp) || Math.abs(now - timestamp) > MAX_CLOCK_SKEW_SECONDS) {
      return NextResponse.json({ error: 'Invalid timestamp' }, { status: 400 });
    }

    // Only sign the exact params the app needs. Signing whatever the client sends would let
    // anyone overwrite existing files or change upload settings on our Cloudinary account.
    const paramsToSign = { timestamp, folder: ALLOWED_FOLDER };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );

    return NextResponse.json({ signature });
  } catch (error) {
    console.error('Error generating signature', error);
    return NextResponse.json({ error: 'Failed to sign upload' }, { status: 500 });
  }
}
