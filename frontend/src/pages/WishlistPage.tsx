import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { datasetsApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import DatasetCard from '../components/DatasetCard';
import { FiHeart } from 'react-icons/fi';

export default function WishlistPage() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    loadWishlist();
  }, []);

  const loadWishlist = async () => {
    try {
      const { data } = await datasetsApi.search({ wishlisted: true });
      setDatasets(data.datasets || []);
    } catch { }
    finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-retomy-bg-hover rounded w-1/4" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-retomy-bg-hover rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1 className="text-2xl font-bold text-retomy-text-bright mb-6 flex items-center gap-3">
        <FiHeart /> My Wishlist
        {datasets.length > 0 && <span className="text-sm font-normal text-retomy-text-secondary">({datasets.length} items)</span>}
      </h1>

      {datasets.length === 0 ? (
        <div className="card p-12 text-center">
          <FiHeart className="mx-auto text-retomy-text-secondary mb-3" size={48} />
          <h2 className="text-lg font-semibold text-retomy-text-bright mb-2">No wishlisted datasets</h2>
          <p className="text-sm text-retomy-text-secondary mb-4">Save datasets you're interested in for later.</p>
          <Link to="/browse" className="btn-primary">Browse Datasets</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {datasets.map(ds => <DatasetCard key={ds.DatasetId} dataset={ds} />)}
        </div>
      )}
    </div>
  );
}
