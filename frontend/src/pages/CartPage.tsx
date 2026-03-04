import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { purchasesApi, paymentsApi, getApiError } from '../services/api';
import { formatOwner } from '../utils/name';
import { useAuthStore, useCartStore } from '../store/authStore';
import { FiTrash2, FiShoppingCart, FiPackage, FiArrowRight, FiCreditCard } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function CartPage() {
  const { isAuthenticated } = useAuthStore();
  const { items, total, loadCart, removeItem } = useCartStore();
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    init();
  }, []);

  const init = async () => {
    await loadCart();
    setLoading(false);
  };

  const handleRemove = async (cartItemId: string) => {
    try {
      await removeItem(cartItemId);
      toast.success('Removed from cart');
    } catch {
      toast.error('Failed to remove');
    }
  };

  const handleCheckout = async () => {
    setPurchasing(true);
    try {
      const dataset_ids = items.map((item: any) => item.DatasetId);

      // Use Stripe Checkout for the whole cart
      const { data } = await paymentsApi.createCheckoutSession(dataset_ids);

      if (data.checkout_url) {
        // Redirect to Stripe
        window.location.href = data.checkout_url;
        return;
      }

      if (data.free) {
        // All items were free — already granted
        toast.success(data.message || 'All free data granted!');
        await loadCart();
        navigate('/dashboard');
        return;
      }
    } catch (e: any) {
      toast.error(getApiError(e, 'Checkout failed'));
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-retomy-surface">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div className="h-20 bg-white/[0.03] rounded-2xl animate-shimmer" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-white/[0.03] border border-white/5 rounded-2xl animate-shimmer" style={{ animationDelay: `${i * 100}ms` }} />
              ))}
            </div>
            <div className="h-48 bg-white/[0.03] border border-white/5 rounded-2xl animate-shimmer" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-retomy-surface">
      {/* Header Banner */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/8 via-retomy-bg/80 to-teal-600/8" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/3 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <FiShoppingCart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Shopping Cart</h1>
              <p className="text-sm text-retomy-text-secondary">
                {items.length > 0 ? `${items.length} item${items.length !== 1 ? 's' : ''} in your cart` : 'Your cart is empty'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {items.length === 0 ? (
          <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/10 border border-white/10 flex items-center justify-center">
              <FiShoppingCart className="text-emerald-400" size={28} />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Your cart is empty</h2>
            <p className="text-sm text-retomy-text-secondary mb-6">Browse our marketplace to find data you need.</p>
            <Link to="/browse" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-emerald-500/20 hover:scale-105 transition-all">
              Browse Data <FiArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-3">
              {items.map((item: any) => (
                <div key={item.CartItemId} className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:bg-white/[0.05] transition-all group">
                  <div className="w-16 h-16 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.ThumbnailUrl ? (
                      <img src={item.ThumbnailUrl} alt="" className="w-full h-full rounded-xl object-cover" />
                    ) : (
                      <FiPackage className="text-indigo-400/40" size={20} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link to={`/dataset/${item.DatasetId}`} className="font-medium text-sm text-white hover:text-indigo-400 truncate block transition-colors">
                      {item.Title}
                    </Link>
                    <p className="text-xs text-retomy-text-secondary mt-0.5">{formatOwner(item.SellerName)} · {item.FileFormat?.toUpperCase()}</p>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      Number(item.Price || 0) === 0 || item.PricingModel === 'free'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-indigo-500/15 text-indigo-400'
                    }`}>
                      {Number(item.Price || 0) === 0 || item.PricingModel === 'free'
                        ? 'Free'
                        : `$${Number(item.Price || 0).toFixed(2)}`}
                    </span>
                    <button onClick={() => handleRemove(item.DatasetId)} className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors opacity-0 group-hover:opacity-100" title="Remove">
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-6 h-fit sticky top-20">
              <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <FiCreditCard size={12} className="text-emerald-400" />
                </div>
                Order Summary
              </h2>
              <div className="space-y-2.5 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-retomy-text-secondary">Subtotal ({items.length} items)</span>
                  <span className="text-white">${total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-retomy-text-secondary">Processing Fee</span>
                  <span className="text-white">$0.00</span>
                </div>
                <div className="border-t border-white/10 pt-2.5 flex justify-between font-semibold">
                  <span className="text-white">Total</span>
                  <span className="text-lg bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">${total.toFixed(2)}</span>
                </div>
              </div>
              <button
                onClick={handleCheckout}
                disabled={purchasing}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-emerald-500/20 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {purchasing ? (
                  <span className="animate-spin">⟳</span>
                ) : (
                  <><FiCreditCard size={14} /> {total > 0 ? 'Checkout with Stripe' : 'Get Free Access'}</>
                )}
              </button>
              <p className="text-[10px] text-retomy-text-secondary text-center mt-3">
                {total > 0
                  ? 'You will be securely redirected to Stripe to complete payment'
                  : 'By completing this you agree to our Terms of Service'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
