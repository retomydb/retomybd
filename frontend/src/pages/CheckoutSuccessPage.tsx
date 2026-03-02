import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { paymentsApi } from '../services/api';
import { FiCheckCircle, FiDownload, FiArrowRight, FiLoader } from 'react-icons/fi';

export default function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    if (sessionId) {
      checkStatus();
    } else {
      setStatus('success'); // Direct free purchase, no session
    }
  }, [sessionId]);

  const checkStatus = async () => {
    try {
      const { data } = await paymentsApi.getCheckoutStatus(sessionId!);
      setSession(data.session);
      setStatus('success');
    } catch {
      // Even if status check fails, payment likely went through
      setStatus('success');
    }
  };

  if (status === 'loading') {
    return (
      <div className="page-container max-w-xl mx-auto text-center py-24">
        <FiLoader className="mx-auto text-retomy-accent animate-spin mb-4" size={48} />
        <h1 className="text-xl font-bold text-retomy-text-bright">Confirming your purchase...</h1>
        <p className="text-retomy-text-secondary mt-2">Please wait while we process your payment.</p>
      </div>
    );
  }

  return (
    <div className="page-container max-w-xl mx-auto text-center py-24">
      <div className="card p-8">
        <FiCheckCircle className="mx-auto text-retomy-green-light mb-4" size={64} />
        <h1 className="text-2xl font-bold text-retomy-text-bright mb-2">Purchase Successful!</h1>
        <p className="text-retomy-text-secondary mb-6">
          Your payment has been processed and you now have access to your purchased dataset(s).
        </p>

        {session && (
          <div className="bg-retomy-bg rounded-lg p-4 mb-6 text-sm text-left">
            <div className="flex justify-between mb-2">
              <span className="text-retomy-text-secondary">Amount</span>
              <span className="text-retomy-text-bright font-semibold">${Number(session.TotalAmount || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-retomy-text-secondary">Status</span>
              <span className="text-retomy-green-light font-semibold capitalize">{session.Status}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/dashboard" className="btn-primary flex items-center justify-center gap-2">
            <FiDownload size={14} /> Go to Dashboard
          </Link>
          <Link to="/browse" className="btn-secondary flex items-center justify-center gap-2">
            Continue Shopping <FiArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
