import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiUser, FiEye, FiEyeOff, FiCheck } from 'react-icons/fi';

export default function SignupPage() {
  const { signup, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  const passwordChecks = {
    length: form.password.length >= 8,
    uppercase: /[A-Z]/.test(form.password),
    lowercase: /[a-z]/.test(form.password),
    digit: /\d/.test(form.password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(form.password),
  };
  const passwordValid = Object.values(passwordChecks).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.email || !form.password || !form.first_name || !form.last_name) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!passwordValid) {
      toast.error('Password does not meet requirements');
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      await signup({
        email: form.email,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
        display_name: `${form.first_name} ${form.last_name}`,
      });
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Signup failed';
      toast.error(message);
    }
  };

  const update = (field: string, value: string) => setForm({ ...form, [field]: value });

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-accent-gradient rounded-md flex items-center justify-center">
              <span className="text-retomy-bg font-extrabold text-lg">rY</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-retomy-text-bright">Create your retomY account</h1>
          <p className="text-sm text-retomy-text-secondary mt-2">
            Join the enterprise dataset marketplace
          </p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">First Name</label>
                <div className="relative">
                  <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-retomy-text-secondary" size={16} />
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={(e) => update('first_name', e.target.value)}
                    className="input-field !pl-10"
                    placeholder="John"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">Last Name</label>
                <input
                  type="text"
                  value={form.last_name}
                  onChange={(e) => update('last_name', e.target.value)}
                  className="input-field"
                  placeholder="Doe"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-retomy-text-secondary" size={16} />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  className="input-field !pl-10"
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-retomy-text-secondary" size={16} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  className="input-field !pl-10 !pr-10"
                  placeholder="Create a strong password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-retomy-text-secondary hover:text-retomy-text-bright"
                >
                  {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
              {/* Password requirements */}
              {form.password && (
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {[
                    { key: 'length', label: '8+ characters' },
                    { key: 'uppercase', label: 'Uppercase' },
                    { key: 'lowercase', label: 'Lowercase' },
                    { key: 'digit', label: 'Number' },
                    { key: 'special', label: 'Special char' },
                  ].map(({ key, label }) => (
                    <div key={key} className={`flex items-center gap-1 text-xs ${
                      passwordChecks[key as keyof typeof passwordChecks] ? 'text-retomy-green-light' : 'text-retomy-text-secondary'
                    }`}>
                      <FiCheck size={10} /> {label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="label">Confirm Password</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => update('confirmPassword', e.target.value)}
                className="input-field"
                placeholder="Confirm your password"
                required
              />
              {form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="text-xs text-retomy-red mt-1">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !passwordValid}
              className="btn-primary w-full !py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating Account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-retomy-text-secondary">
              Already have an account?{' '}
              <Link to="/login" className="text-retomy-accent hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <p className="text-xs text-retomy-text-secondary text-center mt-6">
          By creating an account, you agree to retomY's Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
