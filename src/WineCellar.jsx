import React, { useState, useEffect, useRef } from 'react';
import { Wine, Plus, Search, MapPin, Calendar, Sparkles, X, ChevronDown, Trash2, Edit2, Check, Camera, Loader2, Upload, BookOpen, Download, Share } from 'lucide-react';

const VARIETALS = ['Cabernet Sauvignon', 'Pinot Noir', 'Merlot', 'Syrah/Shiraz', 'Zinfandel', 'Chardonnay', 'Sauvignon Blanc', 'Riesling', 'Pinot Grigio', 'Rosé', 'Champagne/Sparkling', 'Other Red', 'Other White'];
const REGIONS = ['Napa Valley', 'Sonoma', 'Burgundy', 'Bordeaux', 'Rhône', 'Tuscany', 'Piedmont', 'Rioja', 'Willamette Valley', 'Barossa Valley', 'Marlborough', 'Other'];

const analyzeWineLabel = async (base64Image, mediaType) => {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64Image }
          },
          {
            type: "text",
            text: `Analyze this wine label and extract the following information. Respond ONLY with a JSON object, no markdown or explanation:
{
  "name": "wine name (e.g., 'Reserve Cabernet', 'Clos du Val')",
  "producer": "winery/producer name",
  "vintage": year as number or null if not visible,
  "varietal": "grape variety - must be one of: Cabernet Sauvignon, Pinot Noir, Merlot, Syrah/Shiraz, Zinfandel, Chardonnay, Sauvignon Blanc, Riesling, Pinot Grigio, Rosé, Champagne/Sparkling, Other Red, Other White",
  "region": "wine region - should be one of: Napa Valley, Sonoma, Burgundy, Bordeaux, Rhône, Tuscany, Piedmont, Rioja, Willamette Valley, Barossa Valley, Marlborough, or Other if not matching",
  "notes": "any other notable info from the label like vineyard designation, special notes, alcohol %, etc."
}

If you can't determine a field, use null.`
          }
        ]
      }]
    })
  });
  
  const data = await response.json();
  const text = data.content?.[0]?.text || '';
  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
};

const lookupDrinkWindow = async (producer, name, vintage, varietal) => {
  const searchQuery = `${vintage || ''} ${producer} ${name} drink window cellartracker`.trim();
  
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        tools: [{
          type: "web_search_20250305",
          name: "web_search"
        }],
        messages: [{
          role: "user",
          content: `Search for the drink window (when to drink) for this wine: ${vintage || ''} ${producer} ${name} ${varietal || ''}.

Look for information from CellarTracker, Wine Spectator, Vivino, or other wine databases about when this specific wine should be consumed.

Respond ONLY with a JSON object, no markdown:
{
  "drinkFrom": starting year as number,
  "drinkTo": ending year as number,
  "source": "where this info came from (e.g., 'CellarTracker community', 'Wine Spectator')",
  "confidence": "high" or "medium" or "low",
  "notes": "any relevant aging notes found"
}

If you can't find specific data for this wine, estimate based on the wine type and vintage, set confidence to "low", and note it's an estimate.`
        }]
      })
    });
    
    const data = await response.json();
    const fullText = data.content
      ?.map(item => item.type === "text" ? item.text : "")
      .filter(Boolean)
      .join("\n") || '';
    
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const cleaned = jsonMatch[0].replace(/```json|```/g, '').trim();
      return JSON.parse(cleaned);
    }
    return null;
  } catch (e) {
    console.error('Drink window lookup error:', e);
    return null;
  }
};

export default function WineCellar() {
  const [wines, setWines] = useState([]);
  const [drunkWines, setDrunkWines] = useState([]);
  const [view, setView] = useState('inventory');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addMode, setAddMode] = useState('cellar'); // 'cellar' | 'history'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVarietal, setFilterVarietal] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingDrunkId, setEditingDrunkId] = useState(null);
  const [drinkingFromId, setDrinkingFromId] = useState(null); // Track wine being consumed from inventory
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState(''); // 'reading' | 'lookup' | ''
  const [scanError, setScanError] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const fileInputRef = useRef(null);
  const scanModeRef = useRef('cellar');
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    name: '',
    producer: '',
    vintage: new Date().getFullYear() - 5,
    varietal: '',
    region: '',
    quantity: 1,
    location: '',
    drinkFrom: new Date().getFullYear(),
    drinkTo: new Date().getFullYear() + 5,
    notes: '',
    price: '',
    tastingNotes: '',
    rating: '',
    drinkDate: new Date().toISOString().split('T')[0]
  });

  // Load wines from storage on mount
  useEffect(() => {
    const loadWines = () => {
      try {
        const stored = localStorage.getItem('wine-cellar-inventory');
        if (stored) {
          setWines(JSON.parse(stored));
        }
      } catch (e) {
        console.log('No existing cellar data');
      }
      try {
        const historyStored = localStorage.getItem('wine-cellar-history');
        if (historyStored) {
          setDrunkWines(JSON.parse(historyStored));
        }
      } catch (e) {
        console.log('No existing history data');
      }
      setLoading(false);
    };
    loadWines();
  }, []);

  // Save wines to storage whenever they change
  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem('wine-cellar-inventory', JSON.stringify(wines));
      } catch (e) {
        console.error('Failed to save cellar:', e);
      }
    }
  }, [wines, loading]);

  // Save drunk wines to storage whenever they change
  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem('wine-cellar-history', JSON.stringify(drunkWines));
      } catch (e) {
        console.error('Failed to save history:', e);
      }
    }
  }, [drunkWines, loading]);

  // Export data to JSON file
  const exportToJson = (data, filename) => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const currentYear = new Date().getFullYear();

  const resetForm = () => {
    setFormData({
      name: '',
      producer: '',
      vintage: currentYear - 5,
      varietal: '',
      region: '',
      quantity: 1,
      location: '',
      drinkFrom: currentYear,
      drinkTo: currentYear + 5,
      notes: '',
      price: '',
      tastingNotes: '',
      rating: '',
      drinkDate: new Date().toISOString().split('T')[0]
    });
    setEditingId(null);
    setEditingDrunkId(null);
    setDrinkingFromId(null);
    setAddMode('cellar');
    setScanError(null);
    setScanStatus('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (editingDrunkId) {
      // Editing a drunk wine
      setDrunkWines(drunkWines.map(w => w.id === editingDrunkId ? { ...formData, id: editingDrunkId } : w));
    } else if (addMode === 'history') {
      // Adding directly to history
      setDrunkWines([...drunkWines, { 
        ...formData, 
        id: Date.now(),
        drinkDate: formData.drinkDate || new Date().toISOString().split('T')[0]
      }]);
    } else if (editingId) {
      // Editing cellar wine
      setWines(wines.map(w => w.id === editingId ? { ...formData, id: editingId } : w));
    } else {
      // Adding to cellar
      setWines([...wines, { ...formData, id: Date.now() }]);
    }
    resetForm();
    setShowAddForm(false);
  };

  const handleEdit = (wine) => {
    setFormData({ ...wine, tastingNotes: wine.tastingNotes || '', rating: wine.rating || '', drinkDate: wine.drinkDate || new Date().toISOString().split('T')[0] });
    setEditingId(wine.id);
    setAddMode('cellar');
    setShowAddForm(true);
  };

  const handleEditDrunk = (wine) => {
    setFormData({ ...wine });
    setEditingDrunkId(wine.id);
    setAddMode('history');
    setShowAddForm(true);
  };

  const handleDeleteDrunk = (id) => {
    setDrunkWines(drunkWines.filter(w => w.id !== id));
  };

  const consumeWine = (wine) => {
    // Add to drunk wines history
    const drunkEntry = {
      ...wine,
      id: Date.now(),
      drinkDate: new Date().toISOString().split('T')[0],
      tastingNotes: '',
      rating: ''
    };
    setDrunkWines([drunkEntry, ...drunkWines]);
    
    // Decrement from cellar
    adjustQuantity(wine.id, -1);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const mode = scanModeRef.current;
    setAddMode(mode);
    
    setScanning(true);
    setScanStatus('reading');
    setScanError(null);
    setShowAddForm(true);
    
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      const mediaType = file.type || 'image/jpeg';
      const result = await analyzeWineLabel(base64, mediaType);
      
      // Set initial data from label
      setFormData(prev => ({
        ...prev,
        name: result.name || '',
        producer: result.producer || '',
        vintage: result.vintage || currentYear - 5,
        varietal: VARIETALS.includes(result.varietal) ? result.varietal : '',
        region: REGIONS.includes(result.region) ? result.region : 'Other',
        notes: result.notes || '',
        drinkDate: new Date().toISOString().split('T')[0]
      }));
      
      // Now lookup drink window from web sources
      if (result.producer || result.name) {
        setScanStatus('lookup');
        const drinkData = await lookupDrinkWindow(
          result.producer || '',
          result.name || '',
          result.vintage,
          result.varietal
        );
        
        if (drinkData) {
          setFormData(prev => ({
            ...prev,
            drinkFrom: drinkData.drinkFrom || prev.drinkFrom,
            drinkTo: drinkData.drinkTo || prev.drinkTo,
            notes: prev.notes + (drinkData.notes ? `\n${drinkData.source}: ${drinkData.notes}` : 
              drinkData.source ? `\nDrink window from ${drinkData.source}` : '')
          }));
        }
      }
    } catch (err) {
      console.error('Scan error:', err);
      setScanError('Could not read label. Please fill in details manually.');
    } finally {
      setScanning(false);
      setScanStatus('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = (id) => {
    setWines(wines.filter(w => w.id !== id));
  };

  const adjustQuantity = (id, delta) => {
    setWines(wines.map(w => {
      if (w.id === id) {
        const newQty = Math.max(0, w.quantity + delta);
        return { ...w, quantity: newQty };
      }
      return w;
    }).filter(w => w.quantity > 0));
  };

  const filteredWines = wines.filter(wine => {
    const matchesSearch = searchQuery === '' || 
      wine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wine.producer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wine.region.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesVarietal = filterVarietal === '' || wine.varietal === filterVarietal;
    return matchesSearch && matchesVarietal;
  });

  const getRecommendations = () => {
    const now = currentYear;
    return wines
      .filter(w => w.quantity > 0 && w.drinkFrom <= now && w.drinkTo >= now)
      .sort((a, b) => {
        // Prioritize wines closer to end of drink window
        const aUrgency = a.drinkTo - now;
        const bUrgency = b.drinkTo - now;
        return aUrgency - bUrgency;
      })
      .slice(0, 5);
  };

  const getDrinkWindowStatus = (wine) => {
    if (currentYear < wine.drinkFrom) return { status: 'early', label: 'Too Early', color: 'bg-amber-100 text-amber-800' };
    if (currentYear > wine.drinkTo) return { status: 'late', label: 'Past Prime', color: 'bg-red-100 text-red-800' };
    if (wine.drinkTo - currentYear <= 1) return { status: 'urgent', label: 'Drink Soon', color: 'bg-orange-100 text-orange-800' };
    return { status: 'ready', label: 'Ready', color: 'bg-green-100 text-green-800' };
  };

  const totalBottles = wines.reduce((sum, w) => sum + w.quantity, 0);
  const totalValue = wines.reduce((sum, w) => sum + (parseFloat(w.price) || 0) * w.quantity, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-stone-500">Loading your cellar...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-stone-900 text-white px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wine className="w-8 h-8 text-red-400" />
            <h1 className="text-xl font-semibold">Wine Cellar</h1>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="text-stone-400">
              <span className="text-white font-medium">{totalBottles}</span> bottles
              {totalValue > 0 && <span className="ml-3"><span className="text-white font-medium">${totalValue.toLocaleString()}</span> value</span>}
              {drunkWines.length > 0 && <span className="ml-3"><span className="text-white font-medium">{drunkWines.length}</span> logged</span>}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-stone-200 px-6">
        <div className="max-w-5xl mx-auto flex gap-1">
          {[
            { id: 'inventory', label: 'Inventory', icon: Wine },
            { id: 'recommend', label: 'What to Open', icon: Sparkles },
            { id: 'history', label: 'History', icon: BookOpen },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                view === id 
                  ? 'border-red-600 text-red-600' 
                  : 'border-transparent text-stone-600 hover:text-stone-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-6">
        {/* Inventory View */}
        {view === 'inventory' && (
          <div>
            {/* Controls */}
            <div className="flex flex-wrap gap-3 mb-6">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search wines..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
              <select
                value={filterVarietal}
                onChange={(e) => setFilterVarietal(e.target.value)}
                className="px-4 py-2 border border-stone-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">All Varietals</option>
                {VARIETALS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <button
                onClick={() => {
                  setFormData({
                    name: '',
                    producer: '',
                    vintage: currentYear - 5,
                    varietal: '',
                    region: '',
                    quantity: 1,
                    location: '',
                    drinkFrom: currentYear,
                    drinkTo: currentYear + 5,
                    notes: '',
                    price: '',
                    tastingNotes: '',
                    rating: '',
                    drinkDate: new Date().toISOString().split('T')[0]
                  });
                  setEditingId(null);
                  setEditingDrunkId(null);
                  setAddMode('cellar');
                  setScanError(null);
                  setScanStatus('');
                  setShowAddForm(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Wine
              </button>
              <button
                onClick={() => {
                  scanModeRef.current = 'cellar';
                  fileInputRef.current?.click();
                }}
                disabled={scanning}
                className="flex items-center gap-2 px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-900 transition-colors disabled:opacity-50"
              >
                {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                Scan Label
              </button>
              <button
                onClick={() => {
                  setImportJson('');
                  setImportError(null);
                  setShowImportModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 border border-stone-300 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                Import
              </button>
              <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-2 px-4 py-2 border border-stone-300 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-50 transition-colors"
              >
                <Share className="w-4 h-4" />
                Export
              </button>
            </div>

            {/* Wine List */}
            {filteredWines.length === 0 ? (
              <div className="text-center py-16 text-stone-500">
                {wines.length === 0 ? (
                  <>
                    <Wine className="w-12 h-12 mx-auto mb-3 text-stone-300" />
                    <p>Your cellar is empty</p>
                    <p className="text-sm mt-1">Add your first bottle to get started</p>
                  </>
                ) : (
                  <p>No wines match your search</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredWines.map(wine => {
                  const windowStatus = getDrinkWindowStatus(wine);
                  return (
                    <div key={wine.id} className="bg-white rounded-lg border border-stone-200 p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-stone-900">{wine.vintage} {wine.name}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${windowStatus.color}`}>
                              {windowStatus.label}
                            </span>
                          </div>
                          <p className="text-sm text-stone-600 mt-0.5">{wine.producer}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-stone-500">
                            {wine.varietal && <span>{wine.varietal}</span>}
                            {wine.region && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {wine.region}
                              </span>
                            )}
                            {wine.location && (
                              <span className="text-stone-400">📍 {wine.location}</span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {wine.drinkFrom}–{wine.drinkTo}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setFormData({
                                ...wine,
                                tastingNotes: '',
                                rating: '',
                                drinkDate: new Date().toISOString().split('T')[0]
                              });
                              setAddMode('history');
                              setEditingId(null);
                              setEditingDrunkId(null);
                              setDrinkingFromId(wine.id);
                              setShowAddForm(true);
                            }}
                            className="px-2 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                          >
                            Drink
                          </button>
                          <div className="flex items-center bg-stone-100 rounded-lg">
                            <button
                              onClick={() => adjustQuantity(wine.id, -1)}
                              className="w-7 h-7 flex items-center justify-center text-stone-600 hover:bg-stone-200 rounded-l-lg transition-colors text-sm"
                            >
                              −
                            </button>
                            <span className="w-6 text-center text-sm font-medium">{wine.quantity}</span>
                            <button
                              onClick={() => adjustQuantity(wine.id, 1)}
                              className="w-7 h-7 flex items-center justify-center text-stone-600 hover:bg-stone-200 rounded-r-lg transition-colors text-sm"
                            >
                              +
                            </button>
                          </div>
                          <button
                            onClick={() => handleEdit(wine)}
                            className="p-1.5 text-stone-400 hover:text-stone-600 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(wine.id)}
                            className="p-1.5 text-stone-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {wine.notes && (
                        <p className="text-sm text-stone-500 mt-3 italic break-words">"{wine.notes}"</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Recommendations View */}
        {view === 'recommend' && (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                What Should You Open?
              </h2>
              <p className="text-sm text-stone-500 mt-1">
                Wines in their drink window, prioritized by urgency
              </p>
            </div>

            {getRecommendations().length === 0 ? (
              <div className="text-center py-16 text-stone-500">
                <Sparkles className="w-12 h-12 mx-auto mb-3 text-stone-300" />
                <p>No wines currently in their drink window</p>
              </div>
            ) : (
              <div className="space-y-4">
                {getRecommendations().map((wine, index) => {
                  const windowStatus = getDrinkWindowStatus(wine);
                  const yearsLeft = wine.drinkTo - currentYear;
                  return (
                    <div 
                      key={wine.id} 
                      className={`bg-white rounded-lg border-2 p-5 ${
                        index === 0 ? 'border-amber-300 shadow-md' : 'border-stone-200'
                      }`}
                    >
                      {index === 0 && (
                        <div className="text-xs font-medium text-amber-600 uppercase tracking-wide mb-2">
                          Top Pick
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-stone-900 text-lg">
                            {wine.vintage} {wine.name}
                          </h3>
                          <p className="text-stone-600">{wine.producer}</p>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-stone-500">
                            <span>{wine.varietal}</span>
                            <span>{wine.region}</span>
                            {wine.location && <span>📍 {wine.location}</span>}
                          </div>
                          <div className="mt-3">
                            <span className={`text-sm px-3 py-1 rounded-full ${windowStatus.color}`}>
                              {yearsLeft === 0 ? 'Last year in window!' : `${yearsLeft} year${yearsLeft > 1 ? 's' : ''} left in window`}
                            </span>
                          </div>
                          {wine.notes && (
                            <p className="text-sm text-stone-500 mt-3 italic">"{wine.notes}"</p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-semibold text-stone-900">{wine.quantity}</div>
                          <div className="text-sm text-stone-500">bottle{wine.quantity > 1 ? 's' : ''}</div>
                          <button
                            onClick={() => consumeWine(wine)}
                            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                          >
                            Open One
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* History View */}
        {view === 'history' && (
          <div>
            <div className="flex flex-wrap gap-3 mb-6">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search history..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => { resetForm(); setAddMode('history'); setShowAddForm(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Log Wine
              </button>
              <button
                onClick={() => { 
                  scanModeRef.current = 'history';
                  fileInputRef.current?.click();
                }}
                disabled={scanning}
                className="flex items-center gap-2 px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-900 transition-colors disabled:opacity-50"
              >
                {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                Scan & Log
              </button>
            </div>

            {drunkWines.length === 0 ? (
              <div className="text-center py-16 text-stone-500">
                <BookOpen className="w-12 h-12 mx-auto mb-3 text-stone-300" />
                <p>No wines logged yet</p>
                <p className="text-sm mt-1">Open a bottle or scan a label to start your wine journal</p>
              </div>
            ) : (
              <div className="space-y-3">
                {drunkWines
                  .filter(wine => 
                    searchQuery === '' ||
                    wine.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    wine.producer?.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .sort((a, b) => new Date(b.drinkDate) - new Date(a.drinkDate))
                  .map(wine => (
                    <div key={wine.id} className="bg-white rounded-lg border border-stone-200 p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-stone-900">{wine.vintage} {wine.name}</h3>
                            {wine.rating && (
                              <span className="text-sm px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                {'★'.repeat(parseInt(wine.rating))}{'☆'.repeat(5 - parseInt(wine.rating))}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-stone-600 mt-0.5">{wine.producer}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-stone-500">
                            {wine.varietal && <span>{wine.varietal}</span>}
                            {wine.region && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {wine.region}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(wine.drinkDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleEditDrunk(wine)}
                            className="p-1.5 text-stone-400 hover:text-stone-600 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteDrunk(wine.id)}
                            className="p-1.5 text-stone-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {wine.tastingNotes ? (
                        <p className="text-sm text-stone-600 mt-3 bg-stone-50 p-3 rounded-lg break-words">
                          {wine.tastingNotes}
                        </p>
                      ) : (
                        <button
                          onClick={() => handleEditDrunk(wine)}
                          className="text-sm text-red-600 hover:text-red-700 mt-3"
                        >
                          + Add tasting notes
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Hidden file input - always rendered so it works from any view */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Add/Edit Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full my-8">
            <div className="flex items-center justify-between p-4 border-b border-stone-200 sticky top-0 bg-white rounded-t-xl z-10">
              <h2 className="text-lg font-semibold">
                {editingDrunkId ? 'Edit Tasting Notes' : editingId ? 'Edit Wine' : drinkingFromId ? 'Log Tasting' : addMode === 'history' ? 'Log Wine' : 'Add Wine'}
              </h2>
              <button 
                onClick={() => { setShowAddForm(false); resetForm(); setScanError(null); }}
                className="p-1 text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {scanning && (
              <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-stone-600" />
                <span className="text-sm text-stone-600">
                  {scanStatus === 'reading' && 'Reading wine label...'}
                  {scanStatus === 'lookup' && 'Looking up drink window from CellarTracker & wine databases...'}
                </span>
              </div>
            )}
            
            {scanError && (
              <div className="p-4 bg-amber-50 border-b border-amber-200 text-sm text-amber-800">
                {scanError}
              </div>
            )}
            
            <div className="p-4 space-y-4">
              {!editingId && !editingDrunkId && !scanning && (
                <button
                  type="button"
                  onClick={() => {
                    scanModeRef.current = addMode || 'cellar';
                    fileInputRef.current?.click();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-stone-300 text-stone-600 rounded-lg text-sm font-medium hover:border-stone-400 hover:bg-stone-50 transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  Scan Label Photo
                </button>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-stone-700 mb-1">Wine Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Reserve Cabernet"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-stone-700 mb-1">Producer</label>
                  <input
                    type="text"
                    placeholder="e.g., Stag's Leap"
                    value={formData.producer}
                    onChange={(e) => setFormData({ ...formData, producer: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Vintage</label>
                  <input
                    type="number"
                    min="1900"
                    max={currentYear}
                    value={formData.vintage}
                    onChange={(e) => setFormData({ ...formData, vintage: parseInt(e.target.value) || currentYear - 5 })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                {(addMode === 'history' || editingDrunkId) ? (
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Date Consumed</label>
                    <input
                      type="date"
                      value={formData.drinkDate}
                      onChange={(e) => setFormData({ ...formData, drinkDate: e.target.value })}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Varietal</label>
                  <select
                    value={formData.varietal}
                    onChange={(e) => setFormData({ ...formData, varietal: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="">Select...</option>
                    {VARIETALS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Region</label>
                  <select
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="">Select...</option>
                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                
                {addMode !== 'history' && !editingDrunkId && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">Drink From</label>
                      <input
                        type="number"
                        min="1900"
                        max="2100"
                        value={formData.drinkFrom}
                        onChange={(e) => setFormData({ ...formData, drinkFrom: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">Drink To</label>
                      <input
                        type="number"
                        min="1900"
                        max="2100"
                        value={formData.drinkTo}
                        onChange={(e) => setFormData({ ...formData, drinkTo: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">Cellar Location</label>
                      <input
                        type="text"
                        placeholder="e.g., Rack A, Slot 3"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">Price per Bottle</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="$"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  </>
                )}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-stone-700 mb-1">Notes</label>
                  <textarea
                    placeholder="Tasting notes, occasion, etc."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                
                {(addMode === 'history' || editingDrunkId) && (
                  <>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-stone-700 mb-1">Tasting Notes</label>
                      <textarea
                        placeholder="What did you taste? Aromas, flavors, finish..."
                        value={formData.tastingNotes}
                        onChange={(e) => setFormData({ ...formData, tastingNotes: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-stone-700 mb-1">Rating</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setFormData({ ...formData, rating: star.toString() })}
                            className={`text-2xl transition-colors ${
                              parseInt(formData.rating) >= star ? 'text-amber-400' : 'text-stone-300 hover:text-amber-200'
                            }`}
                          >
                            ★
                          </button>
                        ))}
                        {formData.rating && (
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, rating: '' })}
                            className="text-sm text-stone-400 hover:text-stone-600 ml-2"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); resetForm(); }}
                  className="flex-1 px-4 py-2 border border-stone-300 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (editingDrunkId) {
                      setDrunkWines(drunkWines.map(w => w.id === editingDrunkId ? { ...formData, id: editingDrunkId } : w));
                    } else if (addMode === 'history') {
                      // Add to history
                      setDrunkWines([...drunkWines, { 
                        ...formData, 
                        id: Date.now(),
                        drinkDate: formData.drinkDate || new Date().toISOString().split('T')[0]
                      }]);
                      // If drinking from inventory, decrement quantity
                      if (drinkingFromId) {
                        setWines(wines.map(w => {
                          if (w.id === drinkingFromId) {
                            return { ...w, quantity: Math.max(0, w.quantity - 1) };
                          }
                          return w;
                        }).filter(w => w.quantity > 0));
                      }
                    } else if (editingId) {
                      setWines(wines.map(w => w.id === editingId ? { ...formData, id: editingId } : w));
                    } else {
                      setWines([...wines, { ...formData, id: Date.now() }]);
                    }
                    resetForm();
                    setShowAddForm(false);
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  {editingDrunkId ? 'Save Notes' : editingId ? 'Save Changes' : drinkingFromId ? 'Log Tasting' : addMode === 'history' ? 'Log Wine' : 'Add Wine'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full my-8">
            <div className="flex items-center justify-between p-4 border-b border-stone-200">
              <h2 className="text-lg font-semibold">Import Wines</h2>
              <button 
                onClick={() => setShowImportModal(false)}
                className="p-1 text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <p className="text-sm text-stone-600">
                Paste your wine data as JSON below. Each wine should have: name, producer, vintage, varietal, region, quantity, drinkFrom, drinkTo.
              </p>
              
              <textarea
                value={importJson}
                onChange={(e) => {
                  setImportJson(e.target.value);
                  setImportError(null);
                }}
                placeholder={`[\n  {\n    "name": "Wine Name",\n    "producer": "Producer",\n    "vintage": 2020,\n    "varietal": "Cabernet Sauvignon",\n    "region": "Napa Valley",\n    "quantity": 1,\n    "drinkFrom": 2024,\n    "drinkTo": 2030\n  }\n]`}
                rows={12}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              
              {importError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {importError}
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="flex-1 px-4 py-2 border border-stone-300 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const parsed = JSON.parse(importJson);
                      const winesArray = Array.isArray(parsed) ? parsed : [parsed];
                      
                      const newWines = winesArray.map((w, i) => ({
                        id: Date.now() + i,
                        name: w.name || '',
                        producer: w.producer || '',
                        vintage: w.vintage || currentYear - 5,
                        varietal: w.varietal || '',
                        region: w.region || '',
                        quantity: w.quantity || 1,
                        location: w.location || '',
                        drinkFrom: w.drinkFrom || currentYear,
                        drinkTo: w.drinkTo || currentYear + 10,
                        notes: w.notes || '',
                        price: w.price || ''
                      }));
                      
                      setWines([...wines, ...newWines]);
                      setShowImportModal(false);
                      setImportJson('');
                    } catch (e) {
                      setImportError('Invalid JSON. Please check your formatting and try again.');
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  Import Wines
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full my-8">
            <div className="flex items-center justify-between p-4 border-b border-stone-200">
              <h2 className="text-lg font-semibold">Export Data</h2>
              <button 
                onClick={() => setShowExportModal(false)}
                className="p-1 text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <p className="text-sm text-stone-600">
                Export your wine data as JSON files for backup or to use with Claude Code.
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={() => {
                    exportToJson(wines, `wine-inventory-${new Date().toISOString().split('T')[0]}.json`);
                  }}
                  disabled={wines.length === 0}
                  className="w-full flex items-center justify-between p-4 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3">
                    <Wine className="w-5 h-5 text-red-600" />
                    <div className="text-left">
                      <div className="font-medium">Inventory</div>
                      <div className="text-sm text-stone-500">{wines.length} wines</div>
                    </div>
                  </div>
                  <Download className="w-5 h-5 text-stone-400" />
                </button>
                
                <button
                  onClick={() => {
                    exportToJson(drunkWines, `wine-history-${new Date().toISOString().split('T')[0]}.json`);
                  }}
                  disabled={drunkWines.length === 0}
                  className="w-full flex items-center justify-between p-4 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-amber-600" />
                    <div className="text-left">
                      <div className="font-medium">Tasting History</div>
                      <div className="text-sm text-stone-500">{drunkWines.length} entries</div>
                    </div>
                  </div>
                  <Download className="w-5 h-5 text-stone-400" />
                </button>
                
                <button
                  onClick={() => {
                    exportToJson({
                      inventory: wines,
                      history: drunkWines,
                      exportedAt: new Date().toISOString()
                    }, `wine-cellar-full-${new Date().toISOString().split('T')[0]}.json`);
                  }}
                  disabled={wines.length === 0 && drunkWines.length === 0}
                  className="w-full flex items-center justify-between p-4 bg-stone-800 text-white rounded-lg hover:bg-stone-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3">
                    <Share className="w-5 h-5" />
                    <div className="text-left">
                      <div className="font-medium">Export All</div>
                      <div className="text-sm text-stone-300">Inventory + History</div>
                    </div>
                  </div>
                  <Download className="w-5 h-5 text-stone-400" />
                </button>
              </div>
              
              <button
                onClick={() => setShowExportModal(false)}
                className="w-full px-4 py-2 border border-stone-300 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

