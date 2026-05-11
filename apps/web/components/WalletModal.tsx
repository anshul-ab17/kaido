'use client';

import { useState, useCallback } from 'react';
import { X, Shield, ExternalLink, Loader2, CheckCircle2 } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import type { WalletName } from '@solana/wallet-adapter-base';
import { WalletReadyState } from '@solana/wallet-adapter-base';
import { useKaidoStore } from '../store';
import { cn } from '../lib/utils';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface WalletRow {
  id: string;
  name: string;
  description: string;
  /** Adapter name from @solana/wallet-adapter-* — null when not wired (e.g. Ledger). */
  adapterName: WalletName | null;
}

const WALLETS: WalletRow[] = [
  { id: 'phantom',  name: 'Phantom',  description: 'The most popular Solana wallet', adapterName: 'Phantom' as WalletName },
  { id: 'backpack', name: 'Backpack', description: 'xNFT wallet by Coral',           adapterName: 'Backpack' as WalletName },
  { id: 'solflare', name: 'Solflare', description: 'Feature-rich Solana wallet',     adapterName: 'Solflare' as WalletName },
  { id: 'ledger',   name: 'Ledger',   description: 'Pair hardware via Phantom/Solflare', adapterName: null },
];

function PhantomLogo() {
  return (
    <svg viewBox="0 0 128 128" className="w-6 h-6" fill="none">
      <rect width="128" height="128" rx="28" fill="#AB9FF2"/>
      <path d="M110.5 64c0 25.6-20.7 46.4-46.3 46.4S18 89.6 18 64s20.6-46.4 46.2-46.4S110.5 38.4 110.5 64Z" fill="white"/>
      <ellipse cx="50" cy="60" rx="7" ry="9" fill="#AB9FF2"/>
      <ellipse cx="78" cy="60" rx="7" ry="9" fill="#AB9FF2"/>
      <path d="M38 74c5 10 16 16 26 16s21-6 26-16" stroke="#AB9FF2" strokeWidth="4" strokeLinecap="round"/>
    </svg>
  );
}

function BackpackLogo() {
  return (
    <svg viewBox="0 0 128 128" className="w-6 h-6" fill="none">
      <rect width="128" height="128" rx="28" fill="#E7481F"/>
      <path d="M46 40h36a8 8 0 0 1 8 8v38a8 8 0 0 1-8 8H46a8 8 0 0 1-8-8V48a8 8 0 0 1 8-8Z" fill="white"/>
      <path d="M54 40v-6a10 10 0 0 1 20 0v6" stroke="white" strokeWidth="5" strokeLinecap="round"/>
      <rect x="38" y="63" width="52" height="5" rx="2.5" fill="#E7481F"/>
    </svg>
  );
}

function SolflareLogo() {
  return (
    <svg viewBox="0 0 128 128" className="w-6 h-6" fill="none">
      <rect width="128" height="128" rx="28" fill="#FC7227"/>
      <path d="M64 20 L80 52 L112 56 L88 80 L94 112 L64 96 L34 112 L40 80 L16 56 L48 52 Z" fill="white" opacity="0.9"/>
      <circle cx="64" cy="64" r="14" fill="#FC7227"/>
    </svg>
  );
}

function LedgerLogo() {
  return (
    <svg viewBox="0 0 128 128" className="w-6 h-6" fill="none">
      <rect width="128" height="128" rx="28" fill="#1D1D1D"/>
      <path d="M30 30h44v48H30z" fill="white"/>
      <path d="M30 78h68v20H30z" fill="white"/>
      <path d="M74 30h24v48H74z" fill="white"/>
    </svg>
  );
}

function WalletIcon({ id }: { id: string }) {
  const logos: Record<string, React.ReactNode> = {
    phantom:  <PhantomLogo />,
    backpack: <BackpackLogo />,
    solflare: <SolflareLogo />,
    ledger:   <LedgerLogo />,
  };
  return (
    <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 flex items-center justify-center bg-white/5">
      {logos[id] ?? (
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center" />
      )}
    </div>
  );
}

function uint8ToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

type ConnectStep = 'idle' | 'connecting' | 'signing' | 'verifying' | 'done';

function WalletModalContent({
  onClose,
  onConnect,
}: {
  onClose: () => void;
  onConnect: (pk: string, token: string) => void;
}) {
  const { wallets, select, connect, signMessage } = useWallet();
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [step, setStep] = useState<ConnectStep>('idle');
  const [error, setError] = useState<string | null>(null);

  const isInstalled = useCallback(
    (adapterName: WalletName) =>
      wallets.some(
        (w) => w.adapter.name === adapterName && w.adapter.readyState === WalletReadyState.Installed,
      ),
    [wallets],
  );

  const handleRow = async (row: WalletRow) => {
    if (!row.adapterName) {
      setError('Pair your Ledger in Phantom or Solflare, then connect with that wallet.');
      return;
    }
    if (!isInstalled(row.adapterName)) {
      setError(`${row.name} is not installed. Add the browser extension, refresh, and try again.`);
      return;
    }

    const entry = wallets.find((w) => w.adapter.name === row.adapterName);
    if (!entry) {
      setError('Wallet adapter not available.');
      return;
    }

    setConnectingId(row.id);
    setError(null);
    setStep('connecting');

    try {
      select(row.adapterName);
      await connect();

      const pk = entry.adapter.publicKey?.toBase58();
      if (!pk) throw new Error('Wallet did not provide a public key');

      setStep('signing');
      const challengeRes = await fetch(`${API_URL}/auth/challenge`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ walletAddress: pk }),
      });
      if (!challengeRes.ok) throw new Error('Challenge request failed');
      const { nonce, message } = (await challengeRes.json()) as { nonce: string; message: string };

      const msgBytes = new TextEncoder().encode(message);
      if (!signMessage) throw new Error('This wallet cannot sign messages (SIWS)');
      const sigBytes = await signMessage(msgBytes);
      const sigBase64 = uint8ToBase64(sigBytes);

      setStep('verifying');
      const verifyRes = await fetch(`${API_URL}/auth/verify`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: pk,
          signature:     sigBase64,
          nonce,
          encoding:      'base64',
        }),
      });
      if (!verifyRes.ok) throw new Error('Signature verification failed');
      const { token } = (await verifyRes.json()) as { token: string };

      setStep('done');
      setTimeout(() => {
        onConnect(pk, token);
        onClose();
      }, 600);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setError(msg);
      setStep('idle');
      setConnectingId(null);
    }
  };

  const stepLabel: Record<ConnectStep, string> = {
    idle:         '',
    connecting:   'Connecting…',
    signing:      'Approve in wallet…',
    verifying:    'Verifying…',
    done:         'Connected!',
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm mx-4 bg-[#0E0F00] border border-primary/[0.15] rounded-2xl overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-between px-5 h-14 border-b border-primary/[0.08]">
          <div>
            <h2 className="text-sm font-bold">Connect Wallet</h2>
            <p className="text-[10px] text-gray-600">Sign In With Solana (SIWS)</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {connectingId && (
          <div className="px-5 pt-4 pb-2">
            <div
              className={cn(
                'flex items-center gap-2 text-xs font-medium',
                step === 'done' ? 'text-success' : 'text-primary',
              )}
            >
              {step === 'done'
                ? <CheckCircle2 className="w-4 h-4" />
                : <Loader2 className="w-4 h-4 animate-spin" />}
              {stepLabel[step]}
            </div>
            {error && <p className="text-[11px] text-error mt-1">{error}</p>}
          </div>
        )}

        {!connectingId && error && (
          <div className="px-5 pt-3">
            <p className="text-[11px] text-error">{error}</p>
          </div>
        )}

        <div className="p-3 space-y-1.5">
          {WALLETS.map((row) => {
            const installed = row.adapterName ? isInstalled(row.adapterName) : false;
            const busy      = connectingId !== null;
            const isThis      = connectingId === row.id;

            return (
              <button
                key={row.id}
                type="button"
                onClick={() => void handleRow(row)}
                disabled={busy}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-white/[0.06] hover:border-primary/[0.25] hover:bg-primary/[0.05] transition-all group disabled:opacity-60"
              >
                <WalletIcon id={row.id} />
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold group-hover:text-white transition-colors">{row.name}</p>
                    {row.adapterName && installed && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-success/15 text-success uppercase tracking-wider">
                        Detected
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-600">{row.description}</p>
                </div>
                {isThis
                  ? <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                  : row.adapterName && installed
                    ? <span className="w-2 h-2 rounded-full bg-success shrink-0" />
                    : <ExternalLink className="w-3.5 h-3.5 text-gray-700 group-hover:text-primary transition-colors shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="px-5 pb-5 pt-2 flex items-center gap-2 text-[10px] text-gray-700">
          <Shield className="w-3 h-3 text-success shrink-0" />
          <span>Kaido uses SIWS — your private key never leaves your device. Transactions are signed locally.</span>
        </div>
      </div>
    </div>
  );
}

export function WalletModal() {
  const open         = useKaidoStore((s) => s.walletModalOpen);
  const setOpen      = useKaidoStore((s) => s.setWalletModalOpen);
  const setConnected = useKaidoStore((s) => s.setConnected);
  const addToast     = useKaidoStore((s) => s.addToast);

  if (!open) return null;

  return (
    <WalletModalContent
      onClose={() => setOpen(false)}
      onConnect={(pk, token) => {
        setConnected(pk, token);
        addToast({
          type:    'success',
          title:   'Authenticated',
          message: `${pk.slice(0, 4)}…${pk.slice(-4)} signed in via SIWS`,
        });
      }}
    />
  );
}
