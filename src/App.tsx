import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  CreditCard, 
  User, 
  Settings, 
  ChevronRight, 
  Camera, 
  CheckCircle2, 
  AlertCircle,
  ArrowLeft,
  Zap,
  Hammer,
  Utensils,
  BookOpen,
  LogOut,
  Star
} from 'lucide-react';
import { User as UserType, Request as RequestType, Category, CATEGORY_PRICING } from './types';

// --- Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, loading = false }: any) => {
  const variants = {
    primary: 'bg-osu-scarlet text-white hover:bg-red-700 shadow-md active:scale-95',
    secondary: 'bg-osu-gray text-white hover:bg-gray-700',
    outline: 'border-2 border-osu-scarlet text-osu-scarlet hover:bg-osu-scarlet/5',
    ghost: 'text-osu-gray hover:bg-gray-100'
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled || loading}
      className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant as keyof typeof variants]} ${className}`}
    >
      {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : children}
    </button>
  );
};

const Card = ({ children, className = '' }: any) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-black/5 p-4 ${className}`}>
    {children}
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<UserType | null>(null);
  const [screen, setScreen] = useState<'login' | 'home' | 'request' | 'searching' | 'match' | 'pickup' | 'verify' | 'payment' | 'summary' | 'profile' | 'lending-activity'>('login');
  const [activeRequest, setActiveRequest] = useState<RequestType | null>(null);
  const [availableMode, setAvailableMode] = useState(false);
  const [mockLocation, setMockLocation] = useState(true);
  const [lendingCategories, setLendingCategories] = useState<string[]>(['Electronics', 'Tools', 'Kitchen', 'Study Materials', 'Sports & Outdoors', 'Clothing & Accessories', 'Books', 'Other']);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const resetRequestState = () => {
    setActiveRequest(null);
    setActiveLendingRequest(null);
    setIncomingRequest(null);
    setLenderFlow(false);
    setCapturedImage(null);
    setVerificationResult(null);
    setPickupSpot(null);
    setBorrowerConfirmedPickup(false);
    setLenderConfirmedPickup(false);
    setUseCustomAddress(false);
    setCustomAddress('');
    setAddressConfirmed(false);
  };

  // Pickup state
  const [pickupSpot, setPickupSpot] = useState<string | null>(null);
  const [borrowerConfirmedPickup, setBorrowerConfirmedPickup] = useState(false);
  const [lenderConfirmedPickup, setLenderConfirmedPickup] = useState(false);
  const [useCustomAddress, setUseCustomAddress] = useState(false);
  const [customAddress, setCustomAddress] = useState('');
  const [addressConfirmed, setAddressConfirmed] = useState(false);

  // Form states
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState<Category>('Electronics');
  const [duration, setDuration] = useState(1);
  const [maxDist, setMaxDist] = useState(0.5);
  const [genderPref, setGenderPref] = useState('none');

  // Verification state
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [incomingRequest, setIncomingRequest] = useState<any>(null);
  const [activeLendingRequest, setActiveLendingRequest] = useState<any>(null);
  const [lenderFlow, setLenderFlow] = useState(false);

  const OSU_CENTRAL = { lat: 40.0000, lng: -83.0145 };

  // Location tracking
  useEffect(() => {
    if (!user) return;

    if (mockLocation) {
      setLocation(OSU_CENTRAL);
      updateLocationOnServer(OSU_CENTRAL, availableMode, lendingCategories);
    } else if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(newLoc);
          updateLocationOnServer(newLoc, availableMode, lendingCategories);
        },
        (err) => {
          console.error(err);
          setLocation(OSU_CENTRAL);
        },
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      setLocation(OSU_CENTRAL);
    }
  }, [user, availableMode, lendingCategories, mockLocation]);

  // Incoming Request Simulation
  useEffect(() => {
    let timer: any;
    if (availableMode && !incomingRequest && !activeRequest && !lenderFlow) {
      timer = setTimeout(() => {
        setIncomingRequest({
          id: 'mock-' + Math.random().toString(36).substring(7),
          borrower_name: 'Brutus Buckeye',
          item_name: 'TI-84 Calculator',
          category: 'Study Materials',
          duration_hours: 2,
          distance: 0.3
        });
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [availableMode, incomingRequest, activeRequest, lenderFlow]);

  const updateLocationOnServer = async (loc: { lat: number; lng: number }, mode: boolean, categories: string[]) => {
    if (!user) return;
    await fetch('/api/users/location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId: user.id, 
        ...loc, 
        availableMode: mode,
        lendingCategories: categories.join(',')
      })
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.target as HTMLFormElement);
    const email = formData.get('email') as string;
    const name = formData.get('name') as string;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        setScreen('home');
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const createRequest = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          borrowerId: user?.id,
          itemName,
          category,
          durationHours: duration,
          maxDistance: maxDist,
          genderPreference: genderPref
        })
      });
      const data = await res.json();
      const reqRes = await fetch(`/api/requests/${data.requestId}`);
      const reqData = await reqRes.json();
      setActiveRequest(reqData);
      setScreen('searching');
      
      // Simulate matchmaking
      setTimeout(async () => {
        const matchesRes = await fetch(`/api/requests/${data.requestId}/matches`);
        const matches = await matchesRes.json();
        if (matches.length > 0) {
          await fetch(`/api/requests/${data.requestId}/accept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lenderId: matches[0].id })
          });
          const updatedReq = await fetch(`/api/requests/${data.requestId}`).then(r => r.json());
          setActiveRequest(updatedReq);
          setScreen('match');
        } else {
          alert('No matches found nearby. Try increasing distance.');
          setScreen('home');
        }
      }, 3000);
    } catch (err) {
      alert('Request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
  if (!capturedImage || (!activeRequest && !activeLendingRequest)) return;
  setLoading(true);

  const req = activeRequest || activeLendingRequest;

  try {
    const res = await fetch("/api/verify-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: req.id,
        itemName: req.item_name,     // ✅ required for mock requests
        category: req.category,      // ✅ helpful
        imageDataUrl: capturedImage,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Verification failed");

    setVerificationResult(data);
  } catch (err: any) {
    console.error("Verification error:", err);
    alert(`Verification error: ${err.message || "Verification failed"}`);
  } finally {
    setLoading(false);
  }
};

  const calculatePrice = (cat: Category, hrs: number) => {
    const pricing = CATEGORY_PRICING[cat];
    const total = pricing.base + (pricing.hourly * hrs);
    return Math.min(total, pricing.cap);
  };

  const handlePayment = async () => {
    if (!activeRequest) return;
    setLoading(true);
    const amount = calculatePrice(activeRequest.category as Category, activeRequest.duration_hours);
    const platformFee = amount * 0.1;
    const lenderEarnings = amount - platformFee;

    try {
      await fetch(`/api/requests/${activeRequest.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, platformFee, lenderEarnings })
      });
      setScreen('pickup');
    } catch (err) {
      alert('Payment failed');
    } finally {
      setLoading(false);
    }
  };

  // --- Render Screens ---

  if (screen === 'login') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-osu-light-gray">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-black/5"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 bg-osu-scarlet rounded-2xl flex items-center justify-center mb-4 shadow-lg rotate-3">
              <Zap className="text-white w-10 h-10" />
            </div>
            <h1 className="text-3xl font-bold text-osu-scarlet">UniBazzar</h1>
            <p className="text-osu-gray font-medium">OSU Campus Rental Network</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-osu-gray mb-1 ml-1">OSU Email</label>
              <input 
                name="email" 
                type="email" 
                placeholder="name.number@osu.edu" 
                required 
                className="w-full px-4 py-3 rounded-xl border-2 border-osu-light-gray focus:border-osu-scarlet outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-osu-gray mb-1 ml-1">Full Name</label>
              <input 
                name="name" 
                type="text" 
                placeholder="Brutus Buckeye" 
                required 
                className="w-full px-4 py-3 rounded-xl border-2 border-osu-light-gray focus:border-osu-scarlet outline-none transition-all"
              />
            </div>
            <Button type="submit" className="w-full py-4 text-lg" loading={loading}>
              Sign In with OSU SSO
            </Button>
          </form>
          
          <p className="mt-6 text-center text-xs text-osu-gray">
            Only verified @osu.edu accounts can access this platform.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-osu-light-gray pb-24">
      {/* Header */}
      <header className="bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-50 border-b border-black/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-osu-scarlet rounded-lg flex items-center justify-center">
            <Zap className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-xl text-osu-scarlet">UniBazzar</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-osu-light-gray px-3 py-1.5 rounded-full">
            <div className={`w-2 h-2 rounded-full ${availableMode ? 'bg-green-500 animate-pulse' : 'bg-osu-gray'}`} />
            <span className="text-xs font-bold text-osu-gray uppercase tracking-wider">
              {availableMode ? 'Available' : 'Offline'}
            </span>
          </div>
          <button onClick={() => setScreen('profile')} className="w-10 h-10 rounded-full bg-osu-light-gray flex items-center justify-center overflow-hidden border-2 border-osu-scarlet/20">
            <User className="text-osu-gray w-6 h-6" />
          </button>
        </div>
      </header>

      <main className="p-6 max-w-md mx-auto">
        <AnimatePresence>
          {incomingRequest && (
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed inset-x-6 bottom-24 z-[60]"
            >
              <Card className="border-2 border-osu-scarlet shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Zap className="text-osu-scarlet w-5 h-5" />
                    <span className="font-bold text-osu-scarlet uppercase text-xs tracking-widest">New Request Nearby</span>
                  </div>
                  <button onClick={() => setIncomingRequest(null)} className="text-osu-gray"><AlertCircle className="w-5 h-5" /></button>
                </div>
                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-1">{incomingRequest.item_name}</h3>
                  <p className="text-sm text-osu-gray mb-2">{incomingRequest.category} • {incomingRequest.duration_hours} hours</p>
                  <div className="flex items-center gap-2 text-xs font-bold text-osu-gray">
                    <MapPin className="w-3 h-3" /> {incomingRequest.distance} mi away • {incomingRequest.borrower_name}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" onClick={() => setIncomingRequest(null)}>Ignore</Button>
                  <Button onClick={() => {
                    setLenderFlow(true);
                    setScreen('verify');
                    setActiveLendingRequest(incomingRequest);
                    setIncomingRequest(null); 
                  }}>Accept</Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {screen === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <Card className="osu-gradient text-white p-6">
                <h2 className="text-2xl font-bold mb-1">Need something?</h2>
                <p className="opacity-80 mb-6 font-medium">Borrow from peers across campus in minutes.</p>
                <Button variant="secondary" className="bg-white text-osu-scarlet hover:bg-white/90 w-full" onClick={() => setScreen('request')}>
                  <Search className="w-5 h-5" /> Request an Item
                </Button>
              </Card>

              <Card className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${availableMode ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                      <MapPin className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold">Available Mode</h3>
                      <p className="text-xs text-osu-gray">Lend your items to Buckeyes</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setAvailableMode(!availableMode)}
                    className={`w-14 h-8 rounded-full p-1 transition-colors ${availableMode ? 'bg-osu-scarlet' : 'bg-gray-300'}`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform ${availableMode ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                {availableMode && (
                  <div className="pt-4 border-t border-osu-light-gray">
                    <p className="text-xs font-bold text-osu-gray uppercase tracking-widest mb-3">I'm willing to lend:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {['Electronics', 'Tools', 'Kitchen', 'Study Materials', 'Sports & Outdoors', 'Clothing & Accessories', 'Books', 'Other'].map(cat => (
                        <label key={cat} className="flex items-center gap-2 p-2 rounded-lg hover:bg-osu-light-gray cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={lendingCategories.includes(cat)}
                            onChange={(e) => {
                              if (e.target.checked) setLendingCategories([...lendingCategories, cat]);
                              else setLendingCategories(lendingCategories.filter(c => c !== cat));
                            }}
                            className="w-4 h-4 accent-osu-scarlet"
                          />
                          <span className="text-sm font-medium">{cat}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              <div>
                <h3 className="font-bold text-osu-gray uppercase text-xs tracking-widest mb-4 ml-1">Categories</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { name: 'Electronics', icon: Zap, color: 'bg-blue-50 text-blue-600' },
                    { name: 'Tools', icon: Hammer, color: 'bg-orange-50 text-orange-600' },
                    { name: 'Kitchen', icon: Utensils, color: 'bg-green-50 text-green-600' },
                    { name: 'Study Materials', icon: BookOpen, color: 'bg-purple-50 text-purple-600' },
                    { name: 'Sports & Outdoors', icon: Zap, color: 'bg-emerald-50 text-emerald-600' },
                    { name: 'Clothing & Accessories', icon: User, color: 'bg-pink-50 text-pink-600' },
                    { name: 'Books', icon: BookOpen, color: 'bg-amber-50 text-amber-600' },
                    { name: 'Other', icon: Settings, color: 'bg-gray-50 text-gray-600' },
                  ].map((cat) => (
                    <button 
                      key={cat.name} 
                      onClick={() => {
                        setCategory(cat.name as Category);
                        setScreen('request');
                      }}
                      className="bg-white p-4 rounded-2xl shadow-sm border border-black/5 flex flex-col items-center gap-2 active:scale-95 transition-transform"
                    >
                      <div className={`p-3 rounded-xl ${cat.color}`}>
                        <cat.icon className="w-6 h-6" />
                      </div>
                      <span className="font-bold text-sm">{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Card className="bg-blue-50 border-blue-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-blue-900">Mock OSU Location</h4>
                      <p className="text-[10px] text-blue-700 font-medium">Currently testing from outside campus</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setMockLocation(!mockLocation)}
                    className={`w-12 h-6 rounded-full p-1 transition-colors ${mockLocation ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform ${mockLocation ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </Card>
            </motion.div>
          )}

          {screen === 'request' && (
            <motion.div 
              key="request"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4 mb-2">
                <button onClick={() => setScreen('home')} className="p-2 bg-white rounded-full shadow-sm"><ArrowLeft className="w-5 h-5" /></button>
                <h2 className="text-2xl font-bold">Create Request</h2>
              </div>

              <Card className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-osu-gray mb-1">What do you need?</label>
                  <input 
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="e.g. MacBook Charger, Drill, Toaster"
                    className="w-full px-4 py-3 rounded-xl border-2 border-osu-light-gray focus:border-osu-scarlet outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-osu-gray mb-1">Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(CATEGORY_PRICING) as Category[]).map(cat => (
                      <button 
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${category === cat ? 'bg-osu-scarlet border-osu-scarlet text-white' : 'border-osu-light-gray text-osu-gray'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-osu-gray mb-1">Duration</label>
                    <select 
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl border-2 border-osu-light-gray focus:border-osu-scarlet outline-none bg-white"
                    >
                      <option value={0.5}>30 min</option>
                      <option value={1}>1 hour</option>
                      <option value={2}>2 hours</option>
                      <option value={24}>1 day</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-osu-gray mb-1">Max Distance</label>
                    <select 
                      value={maxDist}
                      onChange={(e) => setMaxDist(Number(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl border-2 border-osu-light-gray focus:border-osu-scarlet outline-none bg-white"
                    >
                      <option value={0.2}>0.2 miles</option>
                      <option value={0.5}>0.5 miles</option>
                      <option value={1}>1 mile</option>
                    </select>
                  </div>
                </div>

                <div className="bg-osu-light-gray p-4 rounded-xl">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-osu-gray">Estimated Cost</span>
                    <span className="font-bold text-lg">${calculatePrice(category, duration).toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-osu-gray uppercase font-bold tracking-wider">Includes base fee + hourly rate</p>
                </div>

                <Button className="w-full py-4" onClick={createRequest} loading={loading}>
                  Find a Lender
                </Button>
              </Card>
            </motion.div>
          )}

          {screen === 'searching' && (
            <motion.div 
              key="searching"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 space-y-8"
            >
              <div className="searching-animation">
                <div className="w-20 h-20 bg-osu-scarlet rounded-full flex items-center justify-center shadow-xl z-10">
                  <Search className="text-white w-10 h-10 animate-pulse" />
                </div>
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">Searching for best match...</h2>
                <p className="text-osu-gray font-medium">Ranking lenders across OSU campus</p>
              </div>
              <Card className="w-full max-w-xs">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-osu-scarlet rounded-full animate-bounce" />
                    <span className="text-sm font-medium">Checking proximity...</span>
                  </div>
                  <div className="flex items-center gap-3 opacity-50">
                    <div className="w-2 h-2 bg-osu-gray rounded-full" />
                    <span className="text-sm font-medium">Verifying reliability scores...</span>
                  </div>
                  <div className="flex items-center gap-3 opacity-50">
                    <div className="w-2 h-2 bg-osu-gray rounded-full" />
                    <span className="text-sm font-medium">Matching item categories...</span>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {screen === 'match' && activeRequest && (
            <motion.div 
              key="match"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <h2 className="text-3xl font-bold">Match Found!</h2>
                <p className="text-osu-gray">A lender has accepted your request.</p>
              </div>

              <Card className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-osu-light-gray rounded-full flex items-center justify-center">
                      <User className="text-osu-gray" />
                    </div>
                    <div>
                      <h3 className="font-bold">{activeRequest.lender_name}</h3>
                      <div className="flex items-center gap-1 text-xs text-osu-gray font-bold">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" /> 4.9 Reliability
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="block font-bold text-osu-scarlet">0.2 mi away</span>
                    <span className="text-xs text-osu-gray font-bold uppercase">~4 min walk</span>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Match Reason</h4>
                  <p className="text-sm text-blue-800 font-medium">
                    Matched because: Close proximity, high reliability score, and 92% item match confidence.
                  </p>
                </div>

                <div className="pt-4 border-t border-osu-light-gray">
                  <p className="text-sm text-osu-gray mb-4">Lender is uploading a photo for your review.</p>
                  <Button className="w-full" onClick={() => setScreen('verify')}>
                    Review Item Photo
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {screen === 'pickup' && (activeRequest || activeLendingRequest) && (
            <motion.div 
              key="pickup"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4 mb-2">
                <button onClick={() => setScreen('home')} className="p-2 bg-white rounded-full shadow-sm"><ArrowLeft className="w-5 h-5" /></button>
                <h2 className="text-2xl font-bold">Coordinate Pickup</h2>
              </div>

              <p className="text-osu-gray text-sm">Coordinate a safe meeting spot. Location revealed after mutual confirmation.</p>

              <div className="space-y-3">
                <h3 className="text-xs font-bold text-osu-gray uppercase tracking-widest ml-1">Suggested Safe Spots</h3>
                {[
                  'Thompson Library Entrance',
                  'RPAC Main Lobby',
                  'Ohio Union West Entrance'
                ].map(spot => (
                  <button 
                    key={spot}
                    disabled={useCustomAddress && !lenderFlow}
                    onClick={() => {
                      setPickupSpot(spot);
                      setUseCustomAddress(false);
                      if (lenderFlow) setLenderConfirmedPickup(true);
                      else setBorrowerConfirmedPickup(true);
                    }}
                    className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${pickupSpot === spot ? 'border-osu-scarlet bg-red-50' : 'border-black/5 bg-white'} ${(useCustomAddress && !lenderFlow) ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <MapPin className={`w-5 h-5 ${pickupSpot === spot ? 'text-osu-scarlet' : 'text-osu-gray'}`} />
                        <span className={`font-bold ${pickupSpot === spot ? 'text-osu-scarlet' : 'text-black'}`}>{spot}</span>
                      </div>
                      {pickupSpot === spot && <CheckCircle2 className="w-5 h-5 text-osu-scarlet" />}
                    </div>
                  </button>
                ))}

                {!lenderFlow && (
                  <div className="pt-4">
                    <h3 className="text-xs font-bold text-osu-gray uppercase tracking-widest ml-1 mb-3">Custom Location</h3>
                    <Card className={`border-2 transition-all ${useCustomAddress ? 'border-osu-scarlet bg-red-50' : 'border-black/5'}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <input 
                          type="checkbox" 
                          id="use-custom"
                          checked={useCustomAddress}
                          onChange={(e) => {
                            setUseCustomAddress(e.target.checked);
                            if (e.target.checked) setPickupSpot(null);
                          }}
                          className="w-4 h-4 accent-osu-scarlet"
                        />
                        <label htmlFor="use-custom" className="text-sm font-bold cursor-pointer">Use my address as pickup point</label>
                      </div>
                      
                      {useCustomAddress && (
                        <div className="space-y-3">
                          <input 
                            type="text"
                            placeholder="Enter your address or dorm"
                            value={customAddress}
                            onChange={(e) => setCustomAddress(e.target.value)}
                            className="w-full p-3 rounded-xl border border-osu-light-gray text-sm focus:outline-none focus:ring-2 focus:ring-osu-scarlet"
                          />
                          <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-xl border border-yellow-100">
                            <input 
                              type="checkbox" 
                              id="confirm-share"
                              checked={addressConfirmed}
                              onChange={(e) => setAddressConfirmed(e.target.checked)}
                              className="mt-1 w-3 h-3 accent-yellow-600"
                            />
                            <label htmlFor="confirm-share" className="text-[10px] text-yellow-800 font-medium">
                              I acknowledge that I am sharing my private address with the lender.
                            </label>
                          </div>
                          <Button 
                            className="w-full text-xs py-2" 
                            disabled={!customAddress || !addressConfirmed}
                            onClick={() => {
                              setPickupSpot(customAddress);
                              setBorrowerConfirmedPickup(true);
                            }}
                          >
                            Set Custom Address
                          </Button>
                        </div>
                      )}
                    </Card>
                  </div>
                )}

                {lenderFlow && borrowerConfirmedPickup && pickupSpot && !['Thompson Library Entrance', 'RPAC Main Lobby', 'Ohio Union West Entrance'].includes(pickupSpot) && (
                  <div className="pt-4">
                    <h3 className="text-xs font-bold text-osu-gray uppercase tracking-widest ml-1 mb-3">Borrower's Custom Location</h3>
                    <Card className={`border-2 border-blue-500 bg-blue-50`}>
                      <div className="flex items-center gap-3">
                        <MapPin className="text-blue-600 w-5 h-5" />
                        <div>
                          <p className="text-sm font-bold">Borrower suggested their address</p>
                          <p className="text-xs text-blue-700">Location will be revealed after you confirm.</p>
                        </div>
                      </div>
                      <Button 
                        className="w-full mt-4 text-xs py-2" 
                        onClick={() => {
                          setLenderConfirmedPickup(true);
                        }}
                      >
                        Accept Custom Location
                      </Button>
                    </Card>
                  </div>
                )}
              </div>

              {pickupSpot && (
                <Card className="bg-blue-50 border-blue-100">
                  <div className="flex items-center gap-3 mb-3">
                    <Clock className="text-blue-600 w-5 h-5" />
                    <span className="font-bold text-blue-900 text-sm">Suggested Time: In 1 hour and 15 minutes</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-blue-700 font-medium">You</span>
                      <span className={`font-bold ${(lenderFlow ? lenderConfirmedPickup : borrowerConfirmedPickup) ? 'text-green-600' : 'text-blue-400'}`}>
                        {(lenderFlow ? lenderConfirmedPickup : borrowerConfirmedPickup) ? 'Confirmed' : 'Pending'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-blue-700 font-medium">{lenderFlow ? (activeLendingRequest?.borrower_name || 'Borrower') : (activeRequest?.lender_name || 'Lender')}</span>
                      <span className={`font-bold ${(lenderFlow ? borrowerConfirmedPickup : lenderConfirmedPickup) ? 'text-green-600' : 'text-blue-400'}`}>
                        {(lenderFlow ? borrowerConfirmedPickup : lenderConfirmedPickup) ? 'Confirmed' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </Card>
              )}

              <Button 
                className="w-full py-4" 
                disabled={!pickupSpot}
                onClick={() => {
                  if (lenderFlow) setLenderConfirmedPickup(true);
                  else setBorrowerConfirmedPickup(true);
                  
                  // Simulate other side confirming after a short delay
                  setLoading(true);
                  setTimeout(() => {
                    if (lenderFlow) setBorrowerConfirmedPickup(true);
                    else setLenderConfirmedPickup(true);
                    setLoading(false);
                  }, 1500);
                }}
              >
                Confirm Selection
              </Button>

              {borrowerConfirmedPickup && lenderConfirmedPickup && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
                  <div className="p-4 bg-green-100 text-green-700 rounded-2xl border border-green-200">
                    <p className="font-bold text-sm mb-1">Pickup Confirmed!</p>
                    <p className="text-xs">Meet at <span className="underline">{pickupSpot}</span> in 1 hour and 15 minutes</p>
                  </div>
                  <Button className="w-full" onClick={() => setScreen('summary')}>
                    Go to Rental Summary
                  </Button>
                </motion.div>
              )}
            </motion.div>
          )}

          {screen === 'verify' && (activeRequest || activeLendingRequest) && (
            <motion.div 
              key="verify"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-bold">{lenderFlow ? "Item Verification" : "Review Item"}</h2>
              <p className="text-osu-gray">
                {lenderFlow 
                  ? "Take a clear photo of the item to verify its condition and authenticity."
                  : "Review the item photo and AI analysis before confirming."}
              </p>

              <Card className="flex flex-col items-center justify-center p-4">
                {capturedImage ? (
                  <div className="relative w-full">
                    <img src={capturedImage} alt="Captured" className="w-full rounded-xl shadow-lg" />
                    <button onClick={() => { setCapturedImage(null); setVerificationResult(null); }} className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full"><AlertCircle className="w-5 h-5" /></button>
                  </div>
                ) : (
                  <div className="text-center py-10 space-y-4">
                    <div className="w-20 h-20 bg-osu-light-gray rounded-full flex items-center justify-center mx-auto">
                      <Camera className="text-osu-gray w-10 h-10" />
                    </div>
                    <p className="text-sm font-bold text-osu-gray">
                      {lenderFlow ? "Take a photo of the item" : `Waiting for lender to upload a photo...`}
                    </p>
                    {lenderFlow ? (
                      <>
                        <input 
                          type="file" 
                          accept="image/*" 
                          capture="environment"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => setCapturedImage(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="hidden"
                          id="camera-input"
                        />
                        <label htmlFor="camera-input" className="inline-block bg-osu-scarlet text-white px-6 py-3 rounded-xl font-bold cursor-pointer">
                          Open Camera
                        </label>
                      </>
                    ) : (
                      !capturedImage && (
                        <div className="space-y-4">
                          <div className="flex justify-center">
                            <div className="w-12 h-12 border-4 border-osu-scarlet border-t-transparent rounded-full animate-spin" />
                          </div>
                          <Button 
                            variant="outline" 
                            className="text-xs"
                            onClick={() => {
                              // 100x100 gray square base64
                              setCapturedImage('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAMUlEQVR4nO3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4MbeAAAF669f0AAAAAElFTkSuQmCC');
                            }}
                          >
                            Simulate Lender Upload
                          </Button>
                        </div>
                      )
                    )}
                  </div>
                )}
              </Card>

              {capturedImage && !verificationResult && (
                <div className="space-y-3">
                  <Button className="w-full py-4" onClick={handleVerify} loading={loading}>
                    Run AI Verification (Optional)
                  </Button>
                  {lenderFlow && (
                    <p className="text-[10px] text-osu-gray text-center font-bold uppercase">
                      Waiting for borrower to review...
                    </p>
                  )}
                </div>
              )}

              {capturedImage && !lenderFlow && (
                <div className="space-y-4">
                  {!verificationResult && (
                    <Button variant="secondary" className="w-full py-4" onClick={() => setVerificationResult({ confidence: 0, detected_item: 'Item', explanation: 'AI skipped by user.' })}>
                      Skip AI & Review Manually
                    </Button>
                  )}
                  
                  {verificationResult && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                      <Card className={`border-2 ${verificationResult.confidence >= 80 ? 'border-green-500 bg-green-50' : 'border-blue-500 bg-blue-50'}`}>
                        <div className="flex items-start gap-3">
                          {verificationResult.confidence >= 80 ? <CheckCircle2 className="text-green-600 w-6 h-6 mt-1" /> : <ShieldCheck className="text-blue-600 w-6 h-6 mt-1" />}
                          <div>
                            <h4 className="font-bold text-lg">{verificationResult.detected_item || 'Item'} detected</h4>
                            <p className="text-sm font-bold opacity-70 mb-2">{verificationResult.confidence || 0}% AI confidence score</p>
                            <p className="text-sm">{verificationResult.explanation}</p>
                          </div>
                        </div>
                      </Card>

                      <div className="space-y-4">
                        <Card className="bg-osu-light-gray">
                          <h4 className="text-xs font-bold text-osu-gray uppercase tracking-widest mb-3">Price Breakdown</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Rental Fee ({activeRequest?.duration_hours}h)</span>
                              <span className="font-bold">${calculatePrice(activeRequest?.category as Category, activeRequest?.duration_hours || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-osu-gray">
                              <span>Platform Fee</span>
                              <span>Included</span>
                            </div>
                          </div>
                        </Card>
                        <div className="grid grid-cols-2 gap-4">
                          <Button variant="outline" className="w-full" onClick={() => { setScreen('home'); resetRequestState(); }}>
                            Decline Item
                          </Button>
                          <Button className="w-full" onClick={() => setScreen('payment')}>
                            Approve & Pay
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {capturedImage && lenderFlow && verificationResult && (
                <Card className="bg-blue-50 border-blue-100 p-6 text-center">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-6 h-6 animate-spin-slow" />
                  </div>
                  <h4 className="font-bold text-blue-900 mb-1">Photo Uploaded!</h4>
                  <p className="text-sm text-blue-700 mb-4">Waiting for borrower to approve and pay...</p>
                  <Button 
                    variant="outline" 
                    className="w-full text-xs border-blue-200 text-blue-600"
                    onClick={() => setScreen('pickup')}
                  >
                    Simulate Borrower Payment
                  </Button>
                </Card>
              )}
            </motion.div>
          )}

          {screen === 'payment' && activeRequest && (
            <motion.div 
              key="payment"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-bold">Payment Confirmation</h2>
              
              <Card className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-osu-light-gray rounded-2xl">
                  <div className="w-12 h-12 bg-osu-scarlet rounded-xl flex items-center justify-center">
                    <Zap className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold">{activeRequest.item_name}</h3>
                    <p className="text-xs text-osu-gray font-bold uppercase">{activeRequest.duration_hours} Hour Rental</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-osu-gray font-medium">Base Fee</span>
                    <span className="font-bold">${CATEGORY_PRICING[activeRequest.category as Category].base.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-osu-gray font-medium">Hourly Rate (${CATEGORY_PRICING[activeRequest.category as Category].hourly}/hr)</span>
                    <span className="font-bold">${(CATEGORY_PRICING[activeRequest.category as Category].hourly * activeRequest.duration_hours).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-osu-gray font-medium">Platform Fee (10%)</span>
                    <span className="font-bold">${(calculatePrice(activeRequest.category as Category, activeRequest.duration_hours) * 0.1).toFixed(2)}</span>
                  </div>
                  <div className="pt-3 border-t border-osu-light-gray flex justify-between items-center">
                    <span className="font-bold text-lg">Total Amount</span>
                    <span className="font-bold text-2xl text-osu-scarlet">${calculatePrice(activeRequest.category as Category, activeRequest.duration_hours).toFixed(2)}</span>
                  </div>
                </div>

                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 flex gap-3">
                  <ShieldCheck className="text-yellow-600 w-6 h-6 shrink-0" />
                  <p className="text-xs text-yellow-800 font-medium">
                    Your payment will be held in escrow and only released to the lender once you confirm the item has been returned.
                  </p>
                </div>

                <Button className="w-full py-4 text-lg" onClick={handlePayment} loading={loading}>
                  <CreditCard className="w-5 h-5" /> Confirm & Pay
                </Button>
              </Card>
            </motion.div>
          )}

          {screen === 'summary' && (activeRequest || activeLendingRequest) && (
            <motion.div 
              key="summary"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6 text-center"
            >
              <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-14 h-14" />
              </div>
              <h2 className="text-3xl font-bold">{lenderFlow ? "Rental Started!" : "Rental Active!"}</h2>
              <p className="text-osu-gray">
                Meet {lenderFlow ? activeLendingRequest?.borrower_name : activeRequest?.lender_name} at {pickupSpot || "the designated spot"} in 1 hour and 15 minutes.
              </p>

              <Card className="text-left space-y-4">
                <div className="flex items-center gap-3 text-osu-scarlet font-bold">
                  <MapPin className="w-5 h-5" />
                  <span>Pickup: {pickupSpot || "Thompson Library North Entrance"}</span>
                </div>
                <div className="flex items-center gap-3 text-osu-gray font-bold">
                  <Clock className="w-5 h-5" />
                  <span>Due back in {((activeRequest || activeLendingRequest)?.duration_hours || 0) + 1} hours and 15 minutes</span>
                </div>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" className="w-full" onClick={() => {
                  setScreen('home');
                  resetRequestState();
                }}>
                  Back Home
                </Button>
                <Button className="w-full" onClick={async () => {
                  setLoading(true);
                  if (activeRequest) {
                    await fetch(`/api/requests/${activeRequest.id}/complete`, { method: 'POST' });
                  }
                  setScreen('home');
                  resetRequestState();
                  setLoading(false);
                }}>
                  {lenderFlow ? "Confirm Return" : "Confirm Return"}
                </Button>
              </div>
            </motion.div>
          )}

          {screen === 'lending-activity' && (
            <motion.div 
              key="lending-activity"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4 mb-2">
                <button onClick={() => setScreen('home')} className="p-2 bg-white rounded-full shadow-sm"><ArrowLeft className="w-5 h-5" /></button>
                <h2 className="text-2xl font-bold">Lending Activity</h2>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-osu-gray uppercase tracking-widest ml-1">Open Requests Near You</h3>
                {[
                  { id: 'mock-req-1', borrower_name: 'Carmen Ohio', item_name: 'Camping Tent', category: 'Sports & Outdoors', duration_hours: 48, distance: 0.4 },
                  { id: 'mock-req-2', borrower_name: 'Oval Walker', item_name: 'Air Fryer', category: 'Kitchen', duration_hours: 3, distance: 0.2 },
                  { id: 'mock-req-3', borrower_name: 'High Street', item_name: 'Psychology Textbook', category: 'Books', duration_hours: 24, distance: 0.5 },
                ].map(req => (
                  <Card key={req.id} className="border-l-4 border-blue-500">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold">{req.item_name}</h4>
                        <p className="text-xs text-osu-gray">{req.category} • {req.duration_hours}h • {req.distance}mi</p>
                      </div>
                      <Button 
                        variant="outline" 
                        className="py-1 px-3 text-xs"
                        onClick={() => {
                          setLenderFlow(true);
                          setScreen('verify');
                          setActiveLendingRequest(req);
                        }}
                      >
                        I Have It
                      </Button>
                    </div>
                    <p className="text-[10px] text-osu-gray font-bold uppercase tracking-wider">Requested by {req.borrower_name}</p>
                  </Card>
                ))}

                <h3 className="text-xs font-bold text-osu-gray uppercase tracking-widest pt-4 ml-1">Active Lends</h3>
                {lenderFlow && activeLendingRequest ? (
                  <Card className="border-l-4 border-osu-scarlet">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold">{activeLendingRequest.item_name}</h4>
                        <p className="text-xs text-osu-gray">Borrower: {activeLendingRequest.borrower_name}</p>
                      </div>
                      <span className="bg-red-50 text-osu-scarlet text-[10px] font-bold px-2 py-1 rounded-full uppercase">In Progress</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-osu-gray">
                      <Clock className="w-3 h-3" /> Due in {activeLendingRequest.duration_hours} hours
                    </div>
                  </Card>
                ) : (
                  <p className="text-sm text-osu-gray italic ml-1">No active lends at the moment.</p>
                )}

                <h3 className="text-xs font-bold text-osu-gray uppercase tracking-widest pt-4 ml-1">Past Lends</h3>
                {[
                  { id: 1, item: 'Scientific Calculator', borrower: 'Jane Doe', date: 'Oct 12', amount: 4.50 },
                  { id: 2, item: 'HDMI Adapter', borrower: 'Sam Smith', date: 'Oct 10', amount: 2.00 },
                  { id: 3, item: 'Bike Pump', borrower: 'Mike Ross', date: 'Oct 05', amount: 3.00 },
                ].map(lend => (
                  <Card key={lend.id} className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-sm">{lend.item}</h4>
                      <p className="text-[10px] text-osu-gray font-medium">{lend.borrower} • {lend.date}</p>
                    </div>
                    <div className="text-right">
                      <span className="block font-bold text-green-600">+${lend.amount.toFixed(2)}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {screen === 'profile' && user && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4 mb-2">
                <button onClick={() => setScreen('home')} className="p-2 bg-white rounded-full shadow-sm"><ArrowLeft className="w-5 h-5" /></button>
                <h2 className="text-2xl font-bold">My Profile</h2>
              </div>

              <Card className="flex flex-col items-center p-8">
                <div className="w-24 h-24 bg-osu-light-gray rounded-full flex items-center justify-center mb-4 border-4 border-osu-scarlet/10">
                  <User className="text-osu-gray w-12 h-12" />
                </div>
                <h3 className="text-xl font-bold">{user.name}</h3>
                <p className="text-osu-gray text-sm mb-6">{user.email}</p>

                <div className="grid grid-cols-2 gap-4 w-full">
                  <div className="bg-osu-light-gray p-4 rounded-2xl text-center">
                    <span className="block text-2xl font-bold text-osu-scarlet">{user.reliability_score * 100}%</span>
                    <span className="text-[10px] font-bold text-osu-gray uppercase tracking-widest">Reliability</span>
                  </div>
                  <div className="bg-osu-light-gray p-4 rounded-2xl text-center">
                    <span className="block text-2xl font-bold text-osu-scarlet">$42.50</span>
                    <span className="text-[10px] font-bold text-osu-gray uppercase tracking-widest">Earnings</span>
                  </div>
                </div>
              </Card>

              <div className="space-y-2">
                <button className="w-full flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-black/5">
                  <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-osu-gray" />
                    <span className="font-bold">Preferences</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-osu-gray" />
                </button>
                <button className="w-full flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-black/5">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-osu-gray" />
                    <span className="font-bold">Verification Status</span>
                  </div>
                  <div className="flex items-center gap-1 text-green-600 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" /> Verified
                  </div>
                </button>
                <button 
                  onClick={() => { setUser(null); setScreen('login'); }}
                  className="w-full flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-black/5 text-red-600"
                >
                  <div className="flex items-center gap-3">
                    <LogOut className="w-5 h-5" />
                    <span className="font-bold">Sign Out</span>
                  </div>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Nav */}
      {user && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-black/5 px-4 py-4 flex justify-between items-center z-50">
          <button onClick={() => setScreen('home')} className={`flex flex-col items-center gap-1 ${screen === 'home' ? 'text-osu-scarlet' : 'text-osu-gray'}`}>
            <Zap className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Home</span>
          </button>
          <button onClick={() => setScreen('request')} className={`flex flex-col items-center gap-1 ${screen === 'request' ? 'text-osu-scarlet' : 'text-osu-gray'}`}>
            <Search className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Borrow</span>
          </button>
          <button onClick={() => setScreen('lending-activity')} className={`flex flex-col items-center gap-1 ${screen === 'lending-activity' ? 'text-osu-scarlet' : 'text-osu-gray'}`}>
            <Hammer className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Lend</span>
          </button>
          <button onClick={() => setScreen('profile')} className={`flex flex-col items-center gap-1 ${screen === 'profile' ? 'text-osu-scarlet' : 'text-osu-gray'}`}>
            <User className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Profile</span>
          </button>
        </nav>
      )}
    </div>
  );
}
