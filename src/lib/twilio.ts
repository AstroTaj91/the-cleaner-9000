import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
const authToken = process.env.TWILIO_AUTH_TOKEN || '';
const twilioNumber = process.env.TWILIO_PHONE_NUMBER || '';

const isTwilioConfigured = 
  accountSid && 
  authToken && 
  twilioNumber && 
  accountSid !== 'your_twilio_account_sid' && 
  authToken !== 'your_twilio_auth_token';

// Lazily initialize client to prevent startup errors
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any = null;
if (isTwilioConfigured) {
  try {
    client = twilio(accountSid, authToken);
  } catch (error) {
    console.error('Failed to initialize Twilio client:', error);
  }
}

interface SmsResult {
  success: boolean;
  messageSid?: string;
  mocked: boolean;
  to: string;
  body: string;
  error?: string;
}

/**
 * Sends an SMS message using Twilio, falling back to a mock handler if credentials are not configured.
 */
export async function sendSms(to: string, body: string): Promise<SmsResult> {
  if (!to || !body) {
    return {
      success: false,
      mocked: false,
      to,
      body,
      error: 'Recipient number (to) and message body (body) are required.'
    };
  }

  if (isTwilioConfigured && client) {
    try {
      const message = await client.messages.create({
        body,
        from: twilioNumber,
        to
      });

      return {
        success: true,
        messageSid: message.sid,
        mocked: false,
        to,
        body
      };
    } catch (error) {
      console.error(`Twilio SMS dispatch failed to ${to}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Twilio API Error';
      return {
        success: false,
        mocked: false,
        to,
        body,
        error: errorMessage
      };
    }
  } else {
    // High-fidelity local logging fallback for dev/testing
    const mockSid = `SM${Math.random().toString(36).substring(2, 17).toUpperCase()}`;
    console.info(`[MOCK SMS SEND]
To: ${to}
From (Twilio): ${twilioNumber || 'NOT_CONFIGURED'}
Message: ${body}
Mock SID: ${mockSid}`);

    return {
      success: true,
      messageSid: mockSid,
      mocked: true,
      to,
      body
    };
  }
}
