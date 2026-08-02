export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  /** мс до автозакрытия; 0 или Infinity — не закрывать автоматически. */
  duration: number;
  action?: ToastAction;
  createdAt: number;
}

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  description?: string;
  duration?: number;
  action?: ToastAction;
  /** Дедупликация: повторный вызов с тем же id обновляет существующий тост. */
  id?: string;
}

export interface ToastApi {
  success: (title: string, options?: ToastOptions) => string;
  error: (title: string, options?: ToastOptions) => string;
  info: (title: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}
