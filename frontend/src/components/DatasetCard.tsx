import { Link } from 'react-router-dom';
import { FiStar, FiDownload, FiShoppingCart, FiHeart, FiFile, FiFileText, FiImage, FiDatabase } from 'react-icons/fi';
import {
  SiPython,
  SiApacheparquet,
} from 'react-icons/si';
import {
  BsFiletypeCsv,
  BsFiletypePdf,
  BsFiletypeXml,
  BsFiletypeSql,
  BsFiletypeXlsx,
  BsFiletypeJson,
} from 'react-icons/bs';
import type { IconType } from 'react-icons';
import { formatOwner } from '../utils/name';
import { truncateWords } from '../utils/text';

/** Map file format string to an icon component + colour */
function getFormatIcon(format: string): { Icon: IconType; color: string; label: string } {
  const f = (format || '').toLowerCase().trim();
  if (['xlsx', 'xls', 'excel'].includes(f))
    return { Icon: BsFiletypeXlsx, color: '#217346', label: 'Excel' };
  if (['csv', 'tsv'].includes(f))
    return { Icon: BsFiletypeCsv, color: '#4CAF50', label: 'CSV' };
  if (f === 'pdf')
    return { Icon: BsFiletypePdf, color: '#E53935', label: 'PDF' };
  if (['parquet', 'pq'].includes(f))
    return { Icon: SiApacheparquet, color: '#50ABF1', label: 'Parquet' };
  if (['json', 'jsonl', 'ndjson'].includes(f))
    return { Icon: BsFiletypeJson, color: '#F5A623', label: 'JSON' };
  if (f === 'xml')
    return { Icon: BsFiletypeXml, color: '#FF6D00', label: 'XML' };
  if (['sql', 'sqlite', 'db'].includes(f))
    return { Icon: BsFiletypeSql, color: '#00758F', label: 'SQL' };
  if (['py', 'python', 'pkl', 'pickle'].includes(f))
    return { Icon: SiPython, color: '#3776AB', label: 'Python' };
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'tiff'].includes(f))
    return { Icon: FiImage, color: '#AB47BC', label: f.toUpperCase() };
  if (['txt', 'md', 'text', 'log'].includes(f))
    return { Icon: FiFileText, color: '#78909C', label: 'Text' };
  if (['hdf5', 'h5', 'hdf', 'nc', 'netcdf'].includes(f))
    return { Icon: FiDatabase, color: '#607D8B', label: f.toUpperCase() };
  // fallback
  return { Icon: FiFile, color: '#90A4AE', label: f ? f.toUpperCase() : 'DATA' };
}

interface DatasetCardProps {
  dataset: any;
  onAddToCart?: (id: string) => void;
  onToggleWishlist?: (id: string) => void;
  showSeller?: boolean;
  showCart?: boolean;
  pricePosition?: 'inline' | 'corner';
}

export default function DatasetCard({ dataset, onAddToCart, onToggleWishlist, showSeller = true, showCart = true, pricePosition = 'inline' }: DatasetCardProps) {
  const formatPrice = (price: number, model: string) => {
    if (model === 'free' || price === 0) return <span className="price-tag-free">Free</span>;
    return <span className="price-tag">${price.toFixed(2)}</span>;
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n?.toString() || '0';
  };

  const { Icon: FormatIcon, color: iconColor, label: formatLabel } = getFormatIcon(
    dataset.FileFormat || dataset.file_format || ''
  );

  return (
    <div className="relative overflow-hidden bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl hover:bg-white/[0.05] hover:border-white/15 transition-all group">
      {/* Hover glow */}
      <div className="absolute -top-10 -right-10 w-28 h-28 bg-indigo-500/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative p-4">
        {/* Price in corner (optional) */}
        {pricePosition === 'corner' && (
          <div className="absolute top-3 right-3">
            {(dataset.PricingModel || dataset.pricing_model) === 'free' || (dataset.Price ?? dataset.price ?? 0) === 0 ? (
              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-400">Free</span>
            ) : (
              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-500/15 text-indigo-400">${(dataset.Price ?? dataset.price ?? 0).toFixed(2)}</span>
            )}
          </div>
        )}
        <div className="flex items-start gap-3">
          <Link to={`/dataset/${dataset.DatasetId || dataset.dataset_id}`} className="flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
              <FiDatabase size={14} className="text-indigo-400" />
            </div>
          </Link>

          <div className="min-w-0">
            <Link to={`/dataset/${dataset.DatasetId || dataset.dataset_id}`}>
              <h3 className="font-semibold text-white text-sm truncate group-hover:text-indigo-400 transition-colors">
                {dataset.Title || dataset.title}
              </h3>
            </Link>

            <p className="text-xs text-retomy-text-secondary mt-1 line-clamp-2">
              {truncateWords(dataset.ShortDescription || dataset.short_description, 16)}
            </p>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 mt-3 text-xs text-retomy-text-secondary">
          {(dataset.AverageRating || dataset.average_rating) && (
            <span className="flex items-center gap-1">
              <FiStar size={12} className="text-amber-400" />
              {Number(dataset.AverageRating || dataset.average_rating).toFixed(1)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <FiDownload size={12} />
            {formatNumber(dataset.TotalDownloads || dataset.total_downloads || 0)}
          </span>
          {(dataset.FileFormat || dataset.file_format) && (
            <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-[10px] font-medium border border-indigo-500/20">
              {(dataset.FileFormat || dataset.file_format).toUpperCase()}
            </span>
          )}
        </div>

        {/* Seller (optional) */}
        {showSeller && (
          <div className="flex items-center gap-1 mt-2 text-xs text-retomy-text-secondary">
            <span>by</span>
            <span className="text-indigo-400/70 hover:text-indigo-400 cursor-pointer transition-colors">
              {formatOwner(dataset.SellerName || dataset.seller_name)}
            </span>
            {(dataset.IsSellerVerified || dataset.is_seller_verified) && (
              <span className="text-emerald-400" title="Verified Seller">✓</span>
            )}
          </div>
        )}

        {/* Price + Actions */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
          <div>
            {pricePosition === 'inline' && (
              (dataset.PricingModel || dataset.pricing_model) === 'free' || (dataset.Price ?? dataset.price ?? 0) === 0 ? (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold">Free</span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-400 text-xs font-semibold">${(dataset.Price ?? dataset.price ?? 0).toFixed(2)}</span>
              )
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {onToggleWishlist && (
              <button
                onClick={() => onToggleWishlist(dataset.DatasetId || dataset.dataset_id)}
                className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-retomy-text-secondary hover:text-pink-400 hover:bg-pink-500/10 transition-all"
                title="Add to Wishlist"
              >
                <FiHeart size={14} />
              </button>
            )}
            {showCart && onAddToCart && (
              <button
                onClick={() => onAddToCart(dataset.DatasetId || dataset.dataset_id)}
                className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-retomy-text-secondary hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
                title="Add to Cart"
              >
                <FiShoppingCart size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
