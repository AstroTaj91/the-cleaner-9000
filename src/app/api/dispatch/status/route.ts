import { NextResponse } from 'next/server';
import { getDispatches, clearAllLocalDispatches } from '@/lib/dispatch-store';

export async function GET() {
  try {
    const list = await getDispatches();
    return NextResponse.json({
      success: true,
      count: list.length,
      dispatches: list
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { action } = await request.json();
    
    if (action === 'reset') {
      await clearAllLocalDispatches();
      return NextResponse.json({
        success: true,
        message: 'Active dispatches database reset successfully.'
      });
    }

    return NextResponse.json({ error: 'Unknown action request.' }, { status: 400 });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
