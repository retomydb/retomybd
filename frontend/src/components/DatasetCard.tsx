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

  const { Icon: FormatIcon, color: iconColor, label: formatLabel } = getFormatIcon(
    dataset.FileFormat || dataset.file_format || ''
  );

  return (
    <div className="card-hover group overflow-hidden">
      {/* Content with inline thumbnail */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Link to={`/dataset/${dataset.DatasetId || dataset.dataset_id}`} className="flex-shrink-0">
            <div className="relative w-6 h-6">
              <div className="w-full h-full flex items-center justify-center">
                <FiDatabase size={14} style={{ color: '#607D8B' }} />
              </div>
            </div>
          </Link>

          <div className="min-w-0">
            <Link to={`/dataset/${dataset.DatasetId || dataset.dataset_id}`}>
              <h3 className="font-semibold text-retomy-text-bright text-sm truncate group-hover:text-retomy-accent transition-colors">
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
            {formatOwner(dataset.SellerName || dataset.seller_name)}
          </span>
          {(dataset.IsSellerVerified || dataset.is_seller_verified) && (
            <span className="text-retomy-accent" title="Verified Seller">✓</span>
          )}
        </div>

        {/* Price + Actions */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-retomy-border/20">
          <div className="text-sm font-semibold">
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

        {/* Fancy centered divider */}
        <div className="mt-3 flex justify-center">
          <div className="h-px w-11/12 max-w-[280px] bg-gradient-to-r from-transparent via-retomy-border/40 to-transparent" />
        </div>
      </div>
    </div>
  );
}
