import { ApiResponse } from '../types';

class ApiClient {
  private baseUrl: string = '/api/v1';
  private apiKey: string = '';

  public setApiKey(key: string) {
    this.apiKey = key;
  }

  public getApiKey(): string {
    return this.apiKey;
  }

  public async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T | null; error: string | null; latencyMs: number; status: number }> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const start = performance.now();
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });
      const latencyMs = Math.round(performance.now() - start);

      const json: ApiResponse<T> = await response.json().catch(() => ({
        success: response.ok,
        data: null,
      }));

      if (!response.ok) {
        const anyJson = json as any;
        const errorMsg =
          anyJson?.message ||
          anyJson?.error?.message ||
          (typeof anyJson?.error === 'string' ? anyJson.error : null) ||
          `Request failed with status ${response.status}`;
        return { data: null, error: errorMsg, latencyMs, status: response.status };
      }

      return {
        data: (json.data ?? json) as T,
        error: null,
        latencyMs,
        status: response.status,
      };
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - start);
      return {
        data: null,
        error: err?.message || 'Network connection failed',
        latencyMs,
        status: 0,
      };
    }
  }

  public get<T = any>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  public post<T = any>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public patch<T = any>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public delete<T = any>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
