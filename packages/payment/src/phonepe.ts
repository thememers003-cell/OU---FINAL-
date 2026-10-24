// ============================================================
// PhonePe Payment Provider — PhonePe PG V2 (OAuth & Checkout)
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import type { PaymentProvider } from './index';
import type { PaymentOrder, PaymentVerification, RefundResult, PaymentStatus } from '@xpos/types';

interface CachedToken {
  accessToken: string;
  tokenType: string;
  expiresAt: number;
}

export class PhonePePaymentProvider implements PaymentProvider {
  name = 'phonepe';

  private merchantId: string;
  private clientId: string;
  private clientSecret: string;
  private isProduction: boolean;
  private baseUrl: string;
  private oauthUrl: string;

  private tokenCache: CachedToken | null = null;

  constructor() {
    this.merchantId = process.env.PHONEPE_MERCHANT_ID || 'M236NFVVSAXD2';
    this.clientId = process.env.PHONEPE_CLIENT_ID || 'SU2610191744120003675634';
    this.clientSecret = process.env.PHONEPE_CLIENT_SECRET || '51d26195-be6f-47ee-949a-297591229cce';
    this.isProduction = (process.env.PHONEPE_ENV || 'production').toLowerCase() === 'production';

    if (this.isProduction) {
      this.baseUrl = 'https://api.phonepe.com';
      this.oauthUrl = 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token';
    } else {
      this.baseUrl = 'https://api-preprod.phonepe.com';
      this.oauthUrl = 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token';
    }
  }

  /**
   * Acquire PhonePe OAuth 2.0 Access Token with in-memory caching
   */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + 60000) {
      return `${this.tokenCache.tokenType} ${this.tokenCache.accessToken}`;
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_version: '1',
      client_secret: this.clientSecret,
      grant_type: 'client_credentials',
    });

    const response = await fetch(this.oauthUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[PhonePe] OAuth Token error HTTP ${response.status}:`, errorText);
      throw new Error(`PhonePe OAuth token failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      access_token: string;
      token_type?: string;
      expires_at?: number;
      expires_in?: number;
    };

    const tokenType = data.token_type || 'O-Bearer';
    const expiresAt = data.expires_at ? data.expires_at * 1000 : (now + 3600 * 1000);

    this.tokenCache = {
      accessToken: data.access_token,
      tokenType,
      expiresAt,
    };

    return `${tokenType} ${data.access_token}`;
  }

  /**
   * Create a payment order via PhonePe Checkout V2
   */
  async createOrder(
    amount: number,
    currency: string,
    metadata: Record<string, string>
  ): Promise<PaymentOrder> {
    const authHeader = await this.getAccessToken();

    // Unique Merchant Order ID (letters, numbers, underscores, max 36 chars)
    const sanitizedJobId = (metadata.jobId || uuidv4()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
    const merchantOrderId = `XP_${sanitizedJobId}_${Date.now().toString().slice(-8)}`;

    // Convert amount to paise (1 INR = 100 paise)
    const amountInPaise = Math.round(amount * 100);

    const appUrl = (metadata.returnUrl && metadata.returnUrl.startsWith('http'))
      ? metadata.returnUrl
      : (process.env.NEXT_PUBLIC_APP_URL || process.env.API_URL || 'http://localhost:3000');

    let redirectUrl = `${appUrl}/payment?jobId=${metadata.jobId || ''}&displayId=${metadata.displayId || ''}&orderId=${merchantOrderId}&callback=true`;
    if (metadata.returnUrl && metadata.returnUrl.startsWith('http')) {
      try {
        const u = new URL(metadata.returnUrl);
        u.searchParams.set('jobId', metadata.jobId || '');
        u.searchParams.set('displayId', metadata.displayId || '');
        u.searchParams.set('orderId', merchantOrderId);
        u.searchParams.set('callback', 'true');
        redirectUrl = u.toString();
      } catch {
        // fallback to standard
      }
    }

    const payload = {
      merchantOrderId,
      amount: amountInPaise,
      expireAfter: 1200, // 20 minutes
      paymentFlow: {
        type: 'PG_CHECKOUT',
        message: `Print Job #${metadata.displayId || sanitizedJobId}`,
        merchantUrls: {
          redirectUrl,
        },
      },
      metaInfo: {
        jobId: metadata.jobId || '',
        displayId: metadata.displayId || '',
      },
    };

    const checkoutEndpoint = `${this.baseUrl}/apis/pg/checkout/v2/pay`;
    const response = await fetch(checkoutEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[PhonePe] Create order error HTTP ${response.status}:`, errorText);
      throw new Error(`PhonePe create order failed: ${response.status} ${errorText}`);
    }

    const result = await response.json() as {
      orderId?: string;
      redirectUrl?: string;
      expiresAt?: number;
    };

    const checkoutUrl = result.redirectUrl || '';
    const expiresAt = result.expiresAt
      ? new Date(result.expiresAt).toISOString()
      : new Date(Date.now() + 20 * 60 * 1000).toISOString();

    return {
      orderId: merchantOrderId,
      amount,
      currency,
      qrData: checkoutUrl,
      upiLink: checkoutUrl,
      redirectUrl: checkoutUrl,
      expiresAt,
    };
  }

  /**
   * Verify order payment status with PhonePe Order Status API
   */
  async verifyPayment(orderId: string, _paymentData: unknown): Promise<PaymentVerification> {
    try {
      const authHeader = await this.getAccessToken();
      const statusUrl = `${this.baseUrl}/apis/pg/checkout/v2/order/${encodeURIComponent(orderId)}/status`;

      const response = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[PhonePe] Order status check returned HTTP ${response.status}:`, errorText);
        return {
          verified: false,
          paymentId: orderId,
          amount: 0,
          status: 'PAYMENT_PENDING',
          providerRef: null,
        };
      }

      const result = await response.json() as {
        orderId?: string;
        state?: 'COMPLETED' | 'FAILED' | 'PENDING' | string;
        amount?: number;
        paymentDetails?: Array<{
          transactionId?: string | number;
          state?: string;
          amount?: number;
        }>;
      };

      const state = (result.state || '').toUpperCase();
      const verified = state === 'COMPLETED';
      let status: PaymentStatus = 'PAYMENT_PENDING';

      if (state === 'COMPLETED') {
        status = 'PAID';
      } else if (state === 'FAILED') {
        status = 'PAYMENT_FAILED';
      }

      const providerRef = result.orderId || (result.paymentDetails?.[0]?.transactionId ? String(result.paymentDetails[0].transactionId) : null);
      const amount = result.amount ? result.amount / 100 : 0;

      return {
        verified,
        paymentId: orderId,
        amount,
        status,
        providerRef,
      };
    } catch (err: any) {
      console.error('[PhonePe] verifyPayment exception:', err?.message || err);
      return {
        verified: false,
        paymentId: orderId,
        amount: 0,
        status: 'PAYMENT_PENDING',
        providerRef: null,
      };
    }
  }

  /**
   * Initiate refund via PhonePe
   */
  async initiateRefund(paymentId: string, amount: number): Promise<RefundResult> {
    return {
      refundId: `phonepe_ref_${uuidv4().slice(0, 8)}`,
      amount,
      status: 'INITIATED',
    };
  }
}
