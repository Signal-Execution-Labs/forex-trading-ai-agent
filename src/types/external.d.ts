// Type declarations for modules without types

declare module 'clipboardy' {
  export function write(text: string): Promise<void>;
  export function read(): Promise<string>;
  export function writeSync(text: string): void;
  export function readSync(): string;
}

declare module 'open' {
  interface Options {
    wait?: boolean;
    background?: boolean;
    newInstance?: boolean;
    app?: string | { name: string; arguments?: string[] };
  }
  
  function open(target: string, options?: Options): Promise<void>;
  export default open;
}

declare module 'axios' {
  interface AxiosRequestConfig {
    url?: string;
    method?: string;
    baseURL?: string;
    headers?: Record<string, string>;
    params?: Record<string, any>;
    data?: any;
    timeout?: number;
    responseType?: string;
  }
  
  interface AxiosResponse<T = any> {
    data: T;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    config: AxiosRequestConfig;
  }
  
  interface AxiosInstance {
    get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    defaults: AxiosRequestConfig & { headers: Record<string, Record<string, string>> };
  }
  
  function create(config?: AxiosRequestConfig): AxiosInstance;
  
  const axios: AxiosInstance & {
    create: typeof create;
    isAxiosError(payload: any): boolean;
  };
  
  export default axios;
  export { AxiosRequestConfig, AxiosResponse, AxiosInstance };
}
