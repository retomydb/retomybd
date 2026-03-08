import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore, useCartStore } from '../store/authStore';
import { useState } from 'react';
import {
  FiSearch, FiShoppingCart, FiBell, FiUser, FiLogOut,
  FiChevronDown, FiUpload, FiGrid, FiShield, FiHeart,
} from 'react-icons/fi';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { itemCount } = useCartStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/browse?query=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <nav className="bg-retomy-bg-secondary border-b border-retomy-border/40 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo + Main Nav */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-accent-gradient rounded-md flex items-center justify-center">
                <span className="text-retomy-bg font-extrabold text-sm">rY</span>
              </div>
              <span className="text-retomy-text-bright font-bold text-lg tracking-tight">
                reto<span className="text-retomy-accent">m</span>Y
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-6">
              <Link to="/browse" className="nav-link">Datasets</Link>
              <Link to="/models" className="nav-link">Models</Link>
              <Link to="/spaces" className="nav-link">Spaces</Link>
              <Link to="/docs" className="nav-link">Docs</Link>
              {isAuthenticated && (
                <Link to="/seller" className="nav-link">Sell</Link>
              )}
            </div>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="hidden md:flex items-center flex-1 max-w-md mx-6">
            <div className="relative w-full">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-retomy-text-secondary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search data..."
                className="w-full bg-retomy-bg border border-retomy-border rounded-sm pl-10 pr-4 py-2 text-sm
                           text-retomy-text placeholder-retomy-text-secondary
                           focus:outline-none focus:border-retomy-accent focus:ring-1 focus:ring-retomy-accent/30"
              />
            </div>
          </form>

          {/* Right Side */}
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                {/* Cart */}
                <Link to="/cart" className="relative text-retomy-text-secondary hover:text-retomy-text-bright transition-colors">
                  <FiShoppingCart size={20} />
                  {itemCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-retomy-accent text-retomy-bg text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {itemCount}
                    </span>
                  )}
                </Link>

                {/* Wishlist */}
                <Link to="/wishlist" className="text-retomy-text-secondary hover:text-retomy-text-bright transition-colors">
                  <FiHeart size={20} />
                </Link>

                {/* Notifications */}
                <Link to="/notifications" className="text-retomy-text-secondary hover:text-retomy-text-bright transition-colors">
                  <FiBell size={20} />
                </Link>

                {/* User Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 text-retomy-text hover:text-retomy-text-bright transition-colors"
                  >
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-retomy-accent/20 flex items-center justify-center">
                        <FiUser size={14} className="text-retomy-accent" />
                      </div>
                    )}
                    <span className="hidden lg:block text-sm font-medium max-w-[100px] truncate">
                      {user?.display_name || user?.first_name}
                    </span>
                    <FiChevronDown size={14} />
                  </button>

                  {showUserMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                      <div className="absolute right-0 top-full mt-2 w-56 card overflow-hidden z-50 animate-fade-in">
                        <div className="p-3 border-b border-retomy-border/40 bg-retomy-bg-card">
                          <p className="text-sm font-medium text-retomy-text-bright truncate">{user?.display_name}</p>
                          <p className="text-xs text-retomy-text-secondary truncate">{user?.email}</p>
                          <p className="text-xs text-retomy-accent mt-1">
                            ${user?.credits_balance?.toFixed(2)} credits
                          </p>
                        </div>
                        <div className="py-1">
                          <Link to="/dashboard" onClick={() => setShowUserMenu(false)}
                            className="flex items-center gap-3 px-3 py-2 text-sm text-retomy-text hover:bg-retomy-bg-hover hover:text-retomy-text-bright">
                            <FiGrid size={14} /> Dashboard
                          </Link>
                          <Link to="/profile" onClick={() => setShowUserMenu(false)}
                            className="flex items-center gap-3 px-3 py-2 text-sm text-retomy-text hover:bg-retomy-bg-hover hover:text-retomy-text-bright">
                            <FiUser size={14} /> Profile
                          </Link>
                          {isAuthenticated && (
                            <Link to="/seller" onClick={() => setShowUserMenu(false)}
                              className="flex items-center gap-3 px-3 py-2 text-sm text-retomy-text hover:bg-retomy-bg-hover hover:text-retomy-text-bright">
                              <FiUpload size={14} /> My Account
                            </Link>
                          )}
                          {(user?.role === 'admin' || user?.role === 'superadmin') && (
                            <Link to="/admin" onClick={() => setShowUserMenu(false)}
                              className="flex items-center gap-3 px-3 py-2 text-sm text-retomy-text hover:bg-retomy-bg-hover hover:text-retomy-text-bright">
                              <FiShield size={14} /> Admin Panel
                            </Link>
                          )}
                        </div>
                        <div className="border-t border-retomy-border/40 py-1">
                          <button onClick={() => { logout(); setShowUserMenu(false); navigate('/'); }}
                            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-retomy-red hover:bg-retomy-bg-hover">
                            <FiLogOut size={14} /> Sign Out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login" className="nav-link">Sign In</Link>
                <Link to="/signup" className="btn-primary text-sm !px-4 !py-2">Join Free</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
