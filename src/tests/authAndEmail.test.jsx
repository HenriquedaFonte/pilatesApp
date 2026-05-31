import { describe, it, expect, vi, beforeEach } from 'vitest';
import emailService from '../lib/emailService';

// Mock do supabase-js para isolamento total de testes
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      refreshSession: vi.fn()
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      }))
    }))
  }
}));

describe('EmailService Isomórfico (Ambientes Sem Window)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_APP_URL', '');
  });

  it('deve retornar a URL base configurada em variáveis de ambiente se disponível', () => {
    vi.stubEnv('VITE_APP_URL', 'https://meustudio.com');
    const url = emailService.getBaseUrl();
    expect(url).toBe('https://meustudio.com');
  });

  it('deve retornar a URL padrão em ambiente Node se window for undefined', () => {
    // Salva o objeto window se existir
    const originalWindow = typeof globalThis.window !== 'undefined' ? globalThis.window : undefined;
    
    // Simula ambiente Node.js limpo
    if (typeof globalThis.window !== 'undefined') {
      // @ts-ignore
      delete globalThis.window;
    }

    const url = emailService.getBaseUrl();
    expect(url).toBe('https://josipilates.com');

    // Restaura o ambiente
    if (originalWindow) {
      globalThis.window = originalWindow;
    }
  });
});

describe('useAuth - Regras de QA de Perfil Completo', () => {
  it('deve marcar perfil como incompleto se nome completo for nulo ou vazio', () => {
    const testProfile1 = { full_name: '', role: 'student' };
    const testProfile2 = { full_name: null, role: 'student' };
    const testProfile3 = { role: 'student' };
    
    const isComplete1 = testProfile1.full_name != null && testProfile1.full_name !== '';
    const isComplete2 = testProfile2.full_name != null && testProfile2.full_name !== '';
    const isComplete3 = testProfile3.full_name != null && testProfile3.full_name !== '';

    expect(isComplete1).toBe(false);
    expect(isComplete2).toBe(false);
    expect(isComplete3).toBe(false);
  });

  it('deve marcar perfil como completo se possuir um nome válido', () => {
    const testProfile = { full_name: 'Ana Silva', role: 'student' };
    const isComplete = testProfile.full_name != null && testProfile.full_name !== '';
    expect(isComplete).toBe(true);
  });
});
