import { Link } from 'react-router-dom';
import { FiStar, FiDownload, FiShoppingCart, FiHeart } from 'react-icons/fi';

interface DatasetCardProps {
  dataset: any;
  onAddToCart?: (id: string) => void;
  onToggleWishlist?: (id: string) => void;
}

export default function DatasetCard({ dataset, onAddToCart, onToggleWishlist }: DatasetCardProps) {
  const formatPrice = (price: number, model: string) => {
    if (model === 'free' || price === 0) return <span className="price-tag-free">Free</span>;
    return <span className="price-tag">${price.toFixed(2)}</span>;
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n?.toString() || '0';
  };

  return (
    <div className="card-hover group overflow-hidden">
      {/* Thumbnail */}
      <Link to={`/dataset/${dataset.DatasetId || dataset.dataset_id}`}>
        <div className="relative h-36 bg-retomy-surface overflow-hidden">
          {dataset.ThumbnailUrl || dataset.thumbnail_url ? (
            <img
              src={dataset.ThumbnailUrl || dataset.thumbnail_url}
              alt={dataset.Title || dataset.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-retomy-bg-hover to-retomy-bg-card flex items-center justify-center">
              <div className="text-center">
                <div className="text-3xl font-bold text-retomy-accent/30 uppercase">
                  {(dataset.FileFormat || dataset.file_format || 'DATA').toUpperCase()}
                </div>
                <div className="text-xs text-retomy-text-secondary mt-1">Dataset</div>
              </div>
            </div>
          )}
          {(dataset.IsFeatured || dataset.is_featured) && (
            <div className="absolute top-2 left-2 bg-retomy-gold text-retomy-bg text-xs font-bold px-2 py-0.5 rounded-sm">
              FEATURED
            </div>
          )}
          {dataset.PricingModel === 'free' || dataset.pricing_model === 'free' ? (
            <div className="absolute top-2 right-2 bg-retomy-accent text-retomy-bg text-xs font-bold px-2 py-0.5 rounded-sm">
              FREE
            </div>
          ) : null}
        </div>
      </Link>

      {/* Content */}
      <div className="p-4">
        <Link to={`/dataset/${dataset.DatasetId || dataset.dataset_id}`}>
          <h3 className="font-semibold text-retomy-text-bright text-sm truncate group-hover:text-retomy-accent transition-colors">
            {dataset.Title || dataset.title}
          </h3>
        </Link>

        <p className="text-xs text-retomy-text-secondary mt-1 line-clamp-2 h-8">
          {dataset.ShortDescription || dataset.short_description}
        </p>

        {/* Meta */}
        <div className="flex items-center gap-3 mt-3 text-xs text-retomy-text-secondary">
          {(dataset.AverageRating || dataset.average_rating) && (
            <span className="flex items-center gap-1">
              <FiStar size={12} className="text-retomy-gold" />
              {Number(dataset.AverageRating || dataset.average_rating).toFixed(1)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <FiDownload size={12} />
            {formatNumber(dataset.TotalDownloads || dataset.total_downloads || 0)}
          </span>
          {(dataset.FileFormat || dataset.file_format) && (
            <span className="badge-accent !text-[10px] !px-1.5 !py-0">
              {(dataset.FileFormat || dataset.file_format).toUpperCase()}
            </span>
          )}
        </div>

        {/* Seller */}
        <div className="flex items-center gap-1 mt-2 text-xs text-retomy-text-secondary">
          <span>by</span>
          <span className="text-retomy-accent hover:underline cursor-pointer">
            {dataset.SellerName || dataset.seller_name || 'Unknown'}
          </span>
          {(dataset.IsSellerVerified || dataset.is_seller_verified) && (
            <span className="text-retomy-accent" title="Verified Seller">✓</span>
          )}
        </div>

        {/* Price + Actions */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-retomy-border/20">
          <div className="text-lg font-bold">
            {formatPrice(dataset.Price ?? dataset.price ?? 0, dataset.PricingModel || dataset.pricing_model || 'one-time')}
          </div>
          <div className="flex items-center gap-2">
            {onToggleWishlist && (
              <button
                onClick={() => onToggleWishlist(dataset.DatasetId || dataset.dataset_id)}
                className="text-retomy-text-secondary hover:text-retomy-red transition-colors p-1"
                title="Add to Wishlist"
              >
                <FiHeart size={16} />
              </button>
            )}
            {onAddToCart && (
              <button
                onClick={() => onAddToCart(dataset.DatasetId || dataset.dataset_id)}
                className="text-retomy-text-secondary hover:text-retomy-accent transition-colors p-1"
                title="Add to Cart"
              >
                <FiShoppingCart size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
