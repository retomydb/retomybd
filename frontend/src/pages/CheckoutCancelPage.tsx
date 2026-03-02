import { Link } from 'react-router-dom';
import { FiXCircle, FiShoppingCart, FiArrowRight } from 'react-icons/fi';

export default function CheckoutCancelPage() {
  return (
    <div className="page-container max-w-xl mx-auto text-center py-24">
      <div className="card p-8">
        <FiXCircle className="mx-auto text-retomy-text-secondary mb-4" size={64} />
        <h1 className="text-2xl font-bold text-retomy-text-bright mb-2">Checkout Cancelled</h1>
        <p className="text-retomy-text-secondary mb-6">
          Your payment was not processed. No charges were made. Your cart items are still saved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/cart" className="btn-primary flex items-center justify-center gap-2">
            <FiShoppingCart size={14} /> Return to Cart
          </Link>
          <Link to="/browse" className="btn-secondary flex items-center justify-center gap-2">
            Browse Datasets <FiArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
