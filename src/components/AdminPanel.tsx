import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { db } from '../lib/firebase';
import { collection, query, getDocs, addDoc, doc, deleteDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, Activity, PlusCircle, Calendar, Trash2, HeartPulse, ShieldCheck, Stethoscope, Search, Copy, Clock, Pill, Edit2, Video, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { Logo } from './Logo';
import { LoadingSpinner } from './LoadingSpinner';

export default function AdminPanel() {
  const { t } = useLanguage();
  const { logout } = useAuth();
  const [patients, setPatients] = useState<any[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [patientMeds, setPatientMeds] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'patients' | 'news' | 'videos' | 'settings'>('overview');
  const [news, setNews] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [editingNewsId, setEditingNewsId] = useState<string | null>(null);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [newsForm, setNewsForm] = useState({
      titleUz: '', titleRu: '', titleEn: '', titleUzCyrl: '',
      contentUz: '', contentRu: '', contentEn: '', contentUzCyrl: '',
      imageUrl: '', category: 'general',
      quiz: [] as any[]
  });

  const [videoForm, setVideoForm] = useState({
    titleUz: '', titleRu: '', titleEn: '', titleUzCyrl: '',
    descriptionUz: '', descriptionRu: '', descriptionEn: '', descriptionUzCyrl: '',
    videoUrl: '', 
    quiz: [] as any[]
  });

  const addQuizQuestion = () => {
      setNewsForm(prev => ({
          ...prev,
          quiz: [...prev.quiz, {
              question: { uz: '', ru: '', en: '', 'uz-cyrl': '' },
              options: [
                  { uz: '', ru: '', en: '', 'uz-cyrl': '' },
                  { uz: '', ru: '', en: '', 'uz-cyrl': '' },
                  { uz: '', ru: '', en: '', 'uz-cyrl': '' },
                  { uz: '', ru: '', en: '', 'uz-cyrl': '' }
              ],
              correctOptionIndex: 0
          }]
      }));
  };

  const removeQuizQuestion = (idx: number) => {
      setNewsForm(prev => ({
          ...prev,
          quiz: prev.quiz.filter((_, i) => i !== idx)
      }));
  };

  const updateQuizQuestion = (idx: number, field: string, value: any, lang?: string, optIdx?: number) => {
      const q = [...newsForm.quiz];
      if (field === 'question' && lang) {
          q[idx].question[lang] = value;
      } else if (field === 'option' && lang && optIdx !== undefined) {
          q[idx].options[optIdx][lang] = value;
      } else if (field === 'correctOptionIndex') {
          q[idx].correctOptionIndex = value;
      }
      setNewsForm({...newsForm, quiz: q});
  };
  
  const [medData, setMedData] = useState({
     name: '',
     dosage: '500mg',
     frequency: 'onceDaily',
     durationDays: 7,
     totalPills: 7,
     scheduledTimes: ['08:00'],
     telegramBotToken: '',
     telegramChatId: ''
  });

  useEffect(() => {
    // Fetch patients
    const fetchPatients = async () => {
      try {
        const q = query(collection(db, 'users'));
        const snapshot = await getDocs(q);
        const pts: any[] = [];
        snapshot.forEach(doc => {
          if (doc.data().role === 'patient' && doc.data().isProfileComplete) {
             pts.push({ id: doc.id, ...doc.data() });
          }
        });
        setPatients(pts);
        setFilteredPatients(pts);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPatients();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredPatients(patients);
      return;
    }
    const lowerQuery = searchQuery.toLowerCase();
    setFilteredPatients(patients.filter(p => 
      p.fullName?.toLowerCase().includes(lowerQuery) || 
      p.email?.toLowerCase().includes(lowerQuery)
    ));
  }, [searchQuery, patients]);

  useEffect(() => {
     if (!selectedPatient) return;
     const medsQ = query(collection(db, 'users', selectedPatient.id, 'medications'));
     const unsubscribe = onSnapshot(medsQ, (snapshot) => {
         const m: any[] = [];
         snapshot.forEach(d => m.push({id: d.id, ...d.data()}));
         setPatientMeds(m);
     });
     return () => unsubscribe();
  }, [selectedPatient]);

  useEffect(() => {
      const newsQ = query(collection(db, 'news'));
      const unsubscribe = onSnapshot(newsQ, (snapshot) => {
          const n: any[] = [];
          snapshot.forEach(d => n.push({id: d.id, ...d.data()}));
          setNews(n.sort((a,b) => b.createdAt - a.createdAt));
      });
      return () => unsubscribe();
  }, []);

  useEffect(() => {
      const videosQ = query(collection(db, 'videos'));
      const unsubscribe = onSnapshot(videosQ, (snapshot) => {
          const v: any[] = [];
          snapshot.forEach(d => v.push({id: d.id, ...d.data()}));
          setVideos(v.sort((a,b) => b.createdAt - a.createdAt));
      });
      return () => unsubscribe();
  }, []);

  const parseYoutubeUrl = (url: string) => {
    if (url.includes('iframe')) return url;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    const videoId = (match && match[2].length === 11) ? match[2] : null;
    if (videoId) {
      return `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
    }
    return url;
  };

  const handleSaveVideo = async () => {
    if (!videoForm.titleUz || !videoForm.videoUrl) {
       alert("Iltimos o'zbek tilidagi sarlavha va video URLni kiriting!");
       return;
    }
    try {
      const payload = {
          title: { 
             uz: videoForm.titleUz, 
             ru: videoForm.titleRu || videoForm.titleUz, 
             en: videoForm.titleEn || videoForm.titleUz, 
             'uz-cyrl': videoForm.titleUzCyrl || videoForm.titleUz 
          },
          description: { 
             uz: videoForm.descriptionUz, 
             ru: videoForm.descriptionRu || videoForm.descriptionUz, 
             en: videoForm.descriptionEn || videoForm.descriptionUz, 
             'uz-cyrl': videoForm.descriptionUzCyrl || videoForm.descriptionUz 
          },
          videoUrl: videoForm.videoUrl,
          iframeCode: parseYoutubeUrl(videoForm.videoUrl),
          quiz: videoForm.quiz,
          updatedAt: Date.now()
      };

      if (editingVideoId) {
          await updateDoc(doc(db, 'videos', editingVideoId), payload);
          alert("Video dars yangilandi!");
      } else {
          await addDoc(collection(db, 'videos'), {
              ...payload,
              createdAt: Date.now()
          });
          alert("Video dars qo'shildi!");
      }
      
      setEditingVideoId(null);
      setVideoForm({
        titleUz: '', titleRu: '', titleEn: '', titleUzCyrl: '',
        descriptionUz: '', descriptionRu: '', descriptionEn: '', descriptionUzCyrl: '',
        videoUrl: '', quiz: []
      });
    } catch(e) {
      console.error(e);
      alert("Xatolik yuz berdi");
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
      if (!window.confirm("Video darsni o'chirishni xohlaysizmi?")) return;
      try {
          await deleteDoc(doc(db, 'videos', videoId));
      } catch (e) {
          console.error(e);
      }
  };

  const handleEditVideo = (item: any) => {
      setEditingVideoId(item.id);
      setVideoForm({
          titleUz: item.title.uz || '', 
          titleRu: item.title.ru || '', 
          titleEn: item.title.en || '', 
          titleUzCyrl: item.title['uz-cyrl'] || '',
          descriptionUz: item.description?.uz || '', 
          descriptionRu: item.description?.ru || '', 
          descriptionEn: item.description?.en || '', 
          descriptionUzCyrl: item.description?.['uz-cyrl'] || '',
          videoUrl: item.videoUrl || '', 
          quiz: item.quiz || []
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addVideoQuizQuestion = () => {
    setVideoForm(prev => ({
        ...prev,
        quiz: [...prev.quiz, {
            question: { uz: '', ru: '', en: '', 'uz-cyrl': '' },
            options: [
                { uz: '', ru: '', en: '', 'uz-cyrl': '' },
                { uz: '', ru: '', en: '', 'uz-cyrl': '' },
                { uz: '', ru: '', en: '', 'uz-cyrl': '' },
                { uz: '', ru: '', en: '', 'uz-cyrl': '' }
            ],
            correctOptionIndex: 0
        }]
    }));
  };

  const removeVideoQuizQuestion = (idx: number) => {
    setVideoForm(prev => ({
        ...prev,
        quiz: prev.quiz.filter((_, i) => i !== idx)
    }));
  };

  const updateVideoQuizQuestion = (idx: number, field: string, value: any, lang?: string, optIdx?: number) => {
    const q = [...videoForm.quiz];
    if (field === 'question' && lang) {
        q[idx].question[lang] = value;
    } else if (field === 'option' && lang && optIdx !== undefined) {
        q[idx].options[optIdx][lang] = value;
    } else if (field === 'correctOptionIndex') {
        q[idx].correctOptionIndex = value;
    }
    setVideoForm({...videoForm, quiz: q});
  };

  const handleSaveNews = async () => {
     if (!newsForm.titleUz || !newsForm.contentUz) {
        alert("Iltimos o'zbek tilidagi sarlavha va matnni kiriting!");
        return;
     }
     try {
       const payload = {
           title: { 
              uz: newsForm.titleUz, 
              ru: newsForm.titleRu || newsForm.titleUz, 
              en: newsForm.titleEn || newsForm.titleUz, 
              'uz-cyrl': newsForm.titleUzCyrl || newsForm.titleUz 
           },
           content: { 
              uz: newsForm.contentUz, 
              ru: newsForm.contentRu || newsForm.contentUz, 
              en: newsForm.contentEn || newsForm.contentUz, 
              'uz-cyrl': newsForm.contentUzCyrl || newsForm.contentUz 
           },
           imageUrl: newsForm.imageUrl,
           category: newsForm.category,
           quiz: newsForm.quiz,
           updatedAt: Date.now()
       };

       if (editingNewsId) {
           await updateDoc(doc(db, 'news', editingNewsId), payload);
           alert("Yangilik yangilandi!");
       } else {
           await addDoc(collection(db, 'news'), {
               ...payload,
               createdAt: Date.now()
           });
           alert("Yangilik qo'shildi!");
       }
       
       setEditingNewsId(null);
       setNewsForm({
          titleUz: '', titleRu: '', titleEn: '', titleUzCyrl: '',
          contentUz: '', contentRu: '', contentEn: '', contentUzCyrl: '',
          imageUrl: '', category: 'general', quiz: []
       });
     } catch(e) {
       console.error(e);
       alert("Xatolik yuz berdi");
     }
  };

  const handleDeleteNews = async (newsId: string) => {
      if (!window.confirm("O'chirishni xohlaysizmi?")) return;
      try {
          await deleteDoc(doc(db, 'news', newsId));
      } catch (e) {
          console.error(e);
      }
  };

  const handleEditNews = (item: any) => {
      setEditingNewsId(item.id);
      setNewsForm({
          titleUz: item.title.uz || '', 
          titleRu: item.title.ru || '', 
          titleEn: item.title.en || '', 
          titleUzCyrl: item.title['uz-cyrl'] || '',
          contentUz: item.content.uz || '', 
          contentRu: item.content.ru || '', 
          contentEn: item.content.en || '', 
          contentUzCyrl: item.content['uz-cyrl'] || '',
          imageUrl: item.imageUrl || '', 
          category: item.category || 'general',
          quiz: item.quiz || []
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAssign = async () => {
     if (!selectedPatient || !medData.name) return;
     try {
       const today = new Date().toISOString().split('T')[0];
       const newMed = {
          nameKey: medData.name,
          customName: medData.name,
          dosage: medData.dosage,
          frequencyKey: medData.frequency,
          durationDays: medData.durationDays,
          startDate: today,
          pillsTaken: new Array(medData.durationDays).fill(0),
          totalPills: medData.totalPills,
          remainingPills: medData.totalPills,
          scheduledTimes: medData.scheduledTimes,
          telegramBotToken: medData.telegramBotToken,
          telegramChatId: medData.telegramChatId,
          createdAt: Date.now(),
          typeKey: 'general'
       };

       await addDoc(collection(db, 'users', selectedPatient.id, 'medications'), newMed);
       alert(`Dori muvaffaqiyatli biriktirildi.\nTelegram xabarnoma yuborildi: ${selectedPatient.telegramUsername ? '@' + selectedPatient.telegramUsername : 'Telefon raqamiga'}`);
       setMedData({name: '', dosage: '500mg', frequency: 'onceDaily', durationDays: 7, totalPills: 7, scheduledTimes: ['08:00'], telegramBotToken: '', telegramChatId: ''});
     } catch (e) {
       console.error(e);
       alert('Failed to assign');
     }
  };

  const handleRemoveMed = async (medId: string) => {
      if (!window.confirm("Dorini o'chirishni xohlaysizmi?")) return;
      try {
          await deleteDoc(doc(db, 'users', selectedPatient.id, 'medications', medId));
      } catch (e) {
          console.error(e);
      }
  };

  const handleDeletePatient = async (patientId: string, event: React.MouseEvent) => {
      event.stopPropagation();
      if (!window.confirm("Bu bemorni o'chirishni xohlaysizmi?")) return;
      try {
          await deleteDoc(doc(db, 'users', patientId));
          setPatients(patients.filter(p => p.id !== patientId));
      } catch (e) {
          console.error(e);
          alert("O'chirishda xatolik yuz berdi");
      }
  };

  return (
    <div className="flex h-screen bg-[#0B1120] text-white overflow-hidden font-sans relative">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 blur-[120px] rounded-full" />
      </div>

      {/* Sidebar */}
      <div className="w-72 bg-[#0B1120]/40 backdrop-blur-3xl flex flex-col justify-between border-r border-white/10 relative z-10">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-12">
             <div className="flex items-center justify-center">
               <Logo className="w-12 h-12 shadow-lg shadow-cyan-500/20 rounded-2xl" />
             </div>
             <div>
                <h1 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 tracking-tight">BIGUS</h1>
                <p className="text-[10px] text-cyan-400 font-bold tracking-widest uppercase">Doctor Portal</p>
             </div>
          </div>
          
          <nav className="space-y-3">
             <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-3 font-bold p-4 rounded-2xl transition-all ${activeTab === 'overview' ? 'text-cyan-400 bg-cyan-400/10 shadow-inner border border-cyan-400/20' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}>
               <Activity className="w-5 h-5" /> {t('adminStats')}
             </button>
             <button onClick={() => setActiveTab('patients')} className={`w-full flex items-center gap-3 font-bold p-4 rounded-2xl transition-all ${activeTab === 'patients' ? 'text-cyan-400 bg-cyan-400/10 shadow-inner border border-cyan-400/20' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}>
               <User className="w-5 h-5" /> {t('adminPatients')}
             </button>
             <button onClick={() => setActiveTab('news')} className={`w-full flex items-center gap-3 font-bold p-4 rounded-2xl transition-all ${activeTab === 'news' ? 'text-cyan-400 bg-cyan-400/10 shadow-inner border border-cyan-400/20' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}>
               <Calendar className="w-5 h-5" /> {t('adminNews')}
             </button>
             <button onClick={() => setActiveTab('videos')} className={`w-full flex items-center gap-3 font-bold p-4 rounded-2xl transition-all ${activeTab === 'videos' ? 'text-cyan-400 bg-cyan-400/10 shadow-inner border border-cyan-400/20' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}>
               <Video className="w-5 h-5" /> {t('adminVideos')}
             </button>
             <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 font-bold p-4 rounded-2xl transition-all ${activeTab === 'settings' ? 'text-cyan-400 bg-cyan-400/10 shadow-inner border border-cyan-400/20' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}>
               <ShieldCheck className="w-5 h-5" /> {t('adminSettings')}
             </button>
          </nav>
        </div>
        
        <div className="p-8">
            <button onClick={logout} className="w-full p-4 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-2xl flex items-center justify-center gap-3 transition-all font-bold group">
                <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> {t('logout')}
            </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header */}
        <header className="h-24 px-10 flex items-center justify-between border-b border-white/10 bg-[#0B1120]/40 backdrop-blur-2xl shrink-0 z-10">
           <div>
               <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
                   {activeTab === 'overview' && t('adminStats')}
                   {activeTab === 'patients' && t('patientsManagement')}
                   {activeTab === 'news' && t('adminNews')}
                   {activeTab === 'videos' && t('videoLessons')}
                   {activeTab === 'settings' && t('systemSettings')}
                   {activeTab === 'patients' && <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full border border-blue-500/30">{patients.length} bemor</span>}
                   {activeTab === 'videos' && <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full border border-purple-500/30">{videos.length} video</span>}
               </h2>
           </div>
           <div className="relative">
               <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
               <input 
                 type="text" 
                 placeholder={t('searchByEmail')}
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
                 className="w-[300px] bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/10 focus:border-cyan-500/50 rounded-full py-3.5 pl-12 pr-6 text-sm font-medium outline-none transition-all placeholder-zinc-500"
               />
           </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-auto p-10">
            {activeTab === 'overview' ? (
                <div className="space-y-8 animate-in fade-in duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden group">
                           <div className="absolute -right-6 -top-6 w-24 h-24 bg-cyan-500 rounded-full blur-[40px] opacity-10 group-hover:opacity-20 transition-all"></div>
                           <div className="w-12 h-12 bg-cyan-500/10 text-cyan-400 rounded-xl flex items-center justify-center mb-4">
                              <User className="w-6 h-6" />
                           </div>
                           <h4 className="text-zinc-500 font-bold mb-1">{t('totalPatients')}</h4>
                           <span className="text-3xl font-black text-white">{patients.length}</span>
                        </div>
                        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden group">
                           <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500 rounded-full blur-[40px] opacity-10 group-hover:opacity-20 transition-all"></div>
                           <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center mb-4">
                              <HeartPulse className="w-6 h-6" />
                           </div>
                           <h4 className="text-zinc-500 font-bold mb-1">{t('avgLevel')}</h4>
                           <span className="text-3xl font-black text-white">
                               {patients.length > 0 ? (patients.reduce((sum, p) => sum + (p.level || 1), 0) / patients.length).toFixed(1) : 0}
                           </span>
                        </div>
                        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden group">
                           <div className="absolute -right-6 -top-6 w-24 h-24 bg-green-500 rounded-full blur-[40px] opacity-10 group-hover:opacity-20 transition-all"></div>
                           <div className="w-12 h-12 bg-green-500/10 text-green-400 rounded-xl flex items-center justify-center mb-4">
                              <Activity className="w-6 h-6" />
                           </div>
                           <h4 className="text-zinc-500 font-bold mb-1">{t('totalNews')}</h4>
                           <span className="text-3xl font-black text-white">{news.length}</span>
                        </div>
                        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden group">
                           <div className="absolute -right-6 -top-6 w-24 h-24 bg-purple-500 rounded-full blur-[40px] opacity-10 group-hover:opacity-20 transition-all"></div>
                           <div className="w-12 h-12 bg-purple-500/10 text-purple-400 rounded-xl flex items-center justify-center mb-4">
                              <Video className="w-6 h-6" />
                           </div>
                           <h4 className="text-zinc-500 font-bold mb-1">{t('totalVideos')}</h4>
                           <span className="text-3xl font-black text-white">{videos.length}</span>
                        </div>
                        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden group">
                           <div className="absolute -right-6 -top-6 w-24 h-24 bg-yellow-500 rounded-full blur-[40px] opacity-10 group-hover:opacity-20 transition-all"></div>
                           <div className="w-12 h-12 bg-yellow-500/10 text-yellow-400 rounded-xl flex items-center justify-center mb-4">
                              <ShieldCheck className="w-6 h-6" />
                           </div>
                           <h4 className="text-zinc-500 font-bold mb-1">{t('confirmed')}</h4>
                           <span className="text-3xl font-black text-white">
                               {patients.filter(p => p.isProfileComplete).length}
                           </span>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                       <div className="glass-panel p-8 rounded-3xl">
                           <h3 className="text-lg font-black text-white mb-6">So'nggi Ro'yxatdan O'tganlar</h3>
                           <div className="space-y-4">
                                {patients.slice().reverse().slice(0, 5).map(p => (
                                     <div key={p.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-xl flex items-center justify-center font-bold text-white shadow-inner">
                                               {p.fullName?.[0]}
                                            </div>
                                            <div>
                                                <h4 className="text-white font-bold">{p.fullName}</h4>
                                                <p className="text-xs text-zinc-500">{p.email || 'Email kiritilmagan'}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => { setActiveTab('patients'); setSelectedPatient(p); }} className="px-4 py-2 bg-cyan-500/10 text-cyan-400 text-xs font-bold rounded-lg hover:bg-cyan-500 hover:text-white transition-all">
                                            Ko'rish
                                        </button>
                                     </div>
                                ))}
                                {patients.length === 0 && <p className="text-sm text-zinc-500 font-medium">Bemorlar mavjud emas</p>}
                           </div>
                       </div>
                       
                       <div className="glass-panel p-8 rounded-3xl flex flex-col items-center justify-center text-center">
                           <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mb-6">
                              <Stethoscope className="w-10 h-10 text-blue-400" />
                           </div>
                           <h3 className="text-xl font-black text-white mb-2">Tizim Ishlamoqda</h3>
                           <p className="text-zinc-500 font-medium max-w-sm mb-6">Barcha xizmatlar va ma'lumotlar bazasi barqaror ishlamoqda.</p>
                           <span className="px-4 py-2 bg-green-500/10 text-green-400 font-bold text-xs uppercase tracking-widest rounded-full border border-green-500/20">
                               Status: Online
                           </span>
                       </div>
                    </div>
                </div>
            ) : activeTab === 'patients' ? (
                isLoading ? (
                   <LoadingSpinner fullScreen={false} />
                ) : !selectedPatient ? (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredPatients.map(p => (
                        <motion.div 
                            whileHover={{ y: -4 }}
                            key={p.id} 
                            onClick={() => setSelectedPatient(p)} 
                            className="glass-panel p-6 rounded-3xl cursor-pointer hover:border-cyan-500/50 hover:shadow-[0_8px_30px_rgba(6,182,212,0.15)] group relative overflow-hidden"
                        >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-bl-full pointer-events-none" />
                        <div className="flex items-start justify-between mb-4">
                            <div className="w-14 h-14 bg-[#1C212B] text-cyan-400 rounded-2xl flex items-center justify-center font-black text-2xl border border-white/5 shadow-inner">
                            {p.fullName?.[0]}
                            </div>
                            <div className="flex gap-2">
                               {p.isProfileComplete && (
                                   <div className="p-1.5 bg-green-500/10 text-green-400 rounded-full">
                                       <ShieldCheck className="w-4 h-4" />
                                   </div>
                               )}
                               <button onClick={(e) => handleDeletePatient(p.id, e)} className="p-1.5 bg-red-500/10 text-red-500 rounded-full hover:bg-red-500/20 transition-colors">
                                   <Trash2 className="w-4 h-4" />
                               </button>
                            </div>
                        </div>
                        <h3 className="font-bold text-lg text-white group-hover:text-cyan-300 transition-colors truncate">{p.fullName}</h3>
                        <p className="text-xs text-zinc-500 truncate mt-1">{p.email}</p>
                        
                        <div className="mt-5 bg-white/5 rounded-xl p-3 flex justify-between items-center border border-white/5">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-0.5">Level</span>
                                <span className="font-black text-white">{p.level || 1}</span>
                            </div>
                            <div className="h-6 w-[1px] bg-white/10" />
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-0.5">H-Coins</span>
                                <span className="font-black text-cyan-400">{p.hCoins || 0}</span>
                            </div>
                        </div>
                    </motion.div>
                    ))}
                    {filteredPatients.length === 0 && (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center text-zinc-500">
                            <Search className="w-12 h-12 mb-4 opacity-20" />
                            <p className="font-bold text-lg">Bemorlar topilmadi</p>
                        </div>
                    )}
                </motion.div>
            ) : (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="h-full flex flex-col">
                    <button onClick={() => setSelectedPatient(null)} className="mb-6 self-start text-zinc-400 hover:text-white flex items-center gap-2 font-bold text-sm bg-white/5 px-4 py-2 rounded-full transition-all hover:bg-white/10">
                        ← Orqaga qaytish
                    </button>
                    
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                        {/* Profile Info & Stats */}
                        <div className="xl:col-span-1 space-y-6">
                            <div className="glass-panel p-8 rounded-3xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[80px] rounded-full pointer-events-none" />
                                <div className="flex items-center gap-5 mb-6">
                                    <div className="w-20 h-20 bg-gradient-to-br from-zinc-800 to-zinc-900 text-white rounded-3xl border border-white/10 shadow-2xl flex items-center justify-center text-3xl font-black">
                                       {selectedPatient.fullName[0]}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-white">{selectedPatient.fullName}</h2>
                                        <p className="text-zinc-400 text-sm font-medium">{selectedPatient.email}</p>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5">
                                        <span className="text-sm font-bold text-zinc-400">Telegram</span>
                                        <span className="text-sm font-black text-blue-400 select-all cursor-pointer hover:text-blue-300">
                                            {selectedPatient.telegramUsername ? `@${selectedPatient.telegramUsername}` : 'Biriktirilmagan'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5">
                                        <span className="text-sm font-bold text-zinc-400">Tug'ilgan sana</span>
                                        <span className="text-sm font-black text-white">{selectedPatient.birthDate || 'Kiritilmagan'}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-cyan-500/10 rounded-2xl border border-cyan-500/20 text-center">
                                            <span className="block text-xs font-bold text-cyan-600/70 uppercase mb-1">Level</span>
                                            <span className="block text-xl font-black text-cyan-400">{selectedPatient.level || 1}</span>
                                        </div>
                                        <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-center">
                                            <span className="block text-xs font-bold text-blue-600/70 uppercase mb-1">H-Coins</span>
                                            <span className="block text-xl font-black text-blue-400">{selectedPatient.hCoins || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Current Plan Viewer */}
                            <div className="glass-panel p-8 rounded-3xl">
                                 <h3 className="text-lg font-black text-white flex items-center gap-2 mb-6">
                                     <HeartPulse className="w-5 h-5 text-rose-500" />
                                     Faol dori-darmonlar ({patientMeds.length})
                                 </h3>
                                 <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                     {patientMeds.map(med => (
                                         <div key={med.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 group relative overflow-hidden">
                                             <div className="flex justify-between items-start mb-2">
                                                 <h4 className="font-black text-white text-lg pr-8">{med.customName || med.nameKey}</h4>
                                                 <button onClick={() => handleRemoveMed(med.id)} className="w-8 h-8 flex items-center justify-center bg-red-500/10 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white absolute right-4 top-4">
                                                     <Trash2 className="w-4 h-4" />
                                                 </button>
                                             </div>
                                             <div className="flex flex-wrap gap-2 mb-3">
                                                 <span className="px-2 py-1 bg-white/10 rounded-md text-[10px] font-bold text-zinc-300 uppercase">{med.dosage}</span>
                                                 <span className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded-md text-[10px] font-bold uppercase">{med.frequencyKey}</span>
                                                 <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded-md text-[10px] font-bold uppercase">{med.durationDays} KUN</span>
                                             </div>
                                             <div className="flex justify-between text-xs text-zinc-500 font-bold border-t border-white/5 pt-3 mt-1">
                                                <span>Jami yeyildi: {med.pillsTaken?.reduce((sum: number, taken: any) => sum + (typeof taken === 'number' ? taken : (taken ? (med.frequencyKey === 'thriceDaily' ? 3 : med.frequencyKey === 'twiceDaily' ? 2 : med.frequencyKey === 'fourTimesDaily' ? 4 : 1) : 0)), 0) || 0}/{med.totalPills}</span>
                                             </div>
                                             
                                             <div className="mt-3 border-t border-white/5 pt-3">
                                                <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-2 flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> Tasdiqlanish tarixi</span>
                                                {med.history && med.history.filter((h: any) => h.action === 'taken').length > 0 ? (
                                                    <div className="flex flex-col gap-1.5 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                                                        {med.history
                                                            .filter((h: any) => h.action === 'taken')
                                                            .slice()
                                                            .reverse()
                                                            .map((h: any, i: number) => (
                                                            <div key={i} className="flex justify-between items-center bg-black/20 px-3 py-2 rounded-lg border border-white/5">
                                                                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                                                                   {h.dayIndex + 1}-kun dozasi
                                                                </span>
                                                                <span className="text-[11px] text-zinc-400 font-medium tracking-wide">
                                                                    {new Date(h.timestamp).toLocaleString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="bg-black/20 px-3 py-3 rounded-lg border border-white/5 flex items-center justify-center">
                                                        <span className="text-xs text-zinc-500 font-medium">Hali tasdiqlangan qabullar yo'q</span>
                                                    </div>
                                                )}
                                             </div>
                                         </div>
                                     ))}
                                     {patientMeds.length === 0 && (
                                         <p className="text-sm text-zinc-500 text-center py-4 font-bold">Faol rejalar yo'q</p>
                                     )}
                                 </div>
                            </div>
                        </div>

                        {/* Prescription Form */}
                        <div className="xl:col-span-2 space-y-6">
                            <div className="glass-panel p-8 md:p-10 rounded-3xl relative h-full">
                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-400 to-blue-600 rounded-l-3xl" />
                                <h3 className="text-2xl font-black mb-8 text-white flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400"><Pill className="w-6 h-6" /></div>
                                    Yangi Dori Tayinlash
                                </h3>
                                
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Dori Nomi</label>
                                        <input 
                                          value={medData.name} 
                                          onChange={e => setMedData({...medData, name: e.target.value})} 
                                          type="text" 
                                          placeholder="Masalan: Paracetamol, Vitamin C..." 
                                          className="w-full p-5 bg-black/40 rounded-2xl border border-white/5 outline-none focus:bg-black/60 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all font-bold text-white placeholder-zinc-700" 
                                        />
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Dozasi</label>
                                            <input 
                                              value={medData.dosage} 
                                              onChange={e => setMedData({...medData, dosage: e.target.value})} 
                                              type="text" 
                                              placeholder="Masalan: 500mg, 1 tabletka..." 
                                              className="w-full p-5 bg-black/40 rounded-2xl border border-white/5 outline-none focus:bg-black/60 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all font-bold text-white placeholder-zinc-700" 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Iste'mol chastotasi</label>
                                            <div className="relative">
                                                <Clock className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 pointer-events-none" />
                                                <select 
                                                  value={medData.frequency} 
                                                  onChange={e => {
                                                    const val = e.target.value;
                                                    setMedData(prev => {
                                                        const pPerDay = val === 'onceDaily' ? 1 : val === 'twiceDaily' ? 2 : val === 'thriceDaily' ? 3 : val === 'fourDaily' ? 4 : 1;
                                                        const newTimes = new Array(pPerDay).fill('08:00');
                                                        if (pPerDay === 2) newTimes[1] = '20:00';
                                                        if (pPerDay === 3) { newTimes[1] = '14:00'; newTimes[2] = '20:00'; }
                                                        if (pPerDay === 4) { newTimes[1] = '12:00'; newTimes[2] = '18:00'; newTimes[3] = '22:00'; }
                                                        return {...prev, frequency: val, totalPills: prev.durationDays * pPerDay, scheduledTimes: newTimes};
                                                    })
                                                  }} 
                                                  className="w-full p-5 pl-5 tracking-wide bg-black/40 rounded-2xl border border-white/5 outline-none focus:bg-black/60 focus:ring-2 focus:ring-cyan-500/50 appearance-none text-white font-bold cursor-pointer"
                                                >
                                                   <option value="onceDaily" className="bg-zinc-900">Kuniga 1 mahal</option>
                                                   <option value="twiceDaily" className="bg-zinc-900">Kuniga 2 mahal</option>
                                                   <option value="thriceDaily" className="bg-zinc-900">Kuniga 3 mahal</option>
                                                   <option value="fourDaily" className="bg-zinc-900">Kuniga 4 mahal</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Kurs davomiyligi (kun)</label>
                                            <input 
                                              value={medData.durationDays} 
                                              onChange={e => {
                                                  const duration = parseInt(e.target.value) || 0;
                                                  setMedData(prev => {
                                                      const pPerDay = prev.frequency === 'onceDaily' ? 1 : prev.frequency === 'twiceDaily' ? 2 : prev.frequency === 'thriceDaily' ? 3 : prev.frequency === 'fourDaily' ? 4 : 1;
                                                      return {...prev, durationDays: duration, totalPills: duration * pPerDay};
                                                  })
                                              }} 
                                              type="number" 
                                              placeholder="Masalan: 7" 
                                              min="1"
                                              max="365"
                                              className="w-full p-5 bg-black/40 rounded-2xl border border-white/5 outline-none focus:bg-black/60 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all font-bold text-white placeholder-zinc-700" 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Jami tabletkalar sani (Avto Hisoblangan)</label>
                                            <input 
                                              value={medData.totalPills} 
                                              onChange={e => setMedData({...medData, totalPills: parseInt(e.target.value) || 0})} 
                                              type="number" 
                                              className="w-full p-5 bg-black/20 rounded-2xl border border-white/5 outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all font-black text-cyan-400" 
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1 flex items-center gap-2">
                                            <Clock className="w-4 h-4" /> Dori ichish vaqtlarini belgilang
                                        </label>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {medData.scheduledTimes.map((time, idx) => (
                                                <div key={idx} className="space-y-1">
                                                    <span className="text-[10px] text-zinc-600 font-bold uppercase">{idx + 1}-qabul</span>
                                                    <input 
                                                        type="time"
                                                        value={time}
                                                        onChange={(e) => {
                                                            const newTimes = [...medData.scheduledTimes];
                                                            newTimes[idx] = e.target.value;
                                                            setMedData({...medData, scheduledTimes: newTimes});
                                                        }}
                                                        className="w-full p-3 bg-black/40 rounded-xl border border-white/5 outline-none focus:border-cyan-500/50 text-white font-black text-sm"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-4 border-t border-white/5">
                                        <label className="text-xs font-bold text-cyan-500 uppercase tracking-wider ml-1 flex items-center gap-2">
                                            <Send className="w-4 h-4" /> Telegram Bildirishnomalar (Optional)
                                        </label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                              <span className="text-[10px] text-zinc-500 font-bold ml-1 uppercase">Bot Token</span>
                                              <input 
                                                value={medData.telegramBotToken}
                                                onChange={e => setMedData({...medData, telegramBotToken: e.target.value})}
                                                placeholder="72839401...AHSjd..."
                                                className="w-full p-4 bg-black/40 rounded-xl border border-white/5 outline-none focus:border-cyan-500/50 text-white font-mono text-xs"
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <span className="text-[10px] text-zinc-500 font-bold ml-1 uppercase">Chat ID</span>
                                              <input 
                                                value={medData.telegramChatId}
                                                onChange={e => setMedData({...medData, telegramChatId: e.target.value})}
                                                placeholder="123456789"
                                                className="w-full p-4 bg-black/40 rounded-xl border border-white/5 outline-none focus:border-cyan-500/50 text-white font-mono text-xs"
                                              />
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-zinc-500 italic">
                                            Bot Tokenini @BotFather dan olasiz. Chat ID ni aniqlash uchun botga start bosing va ijtimoiy kanallar orqali IDingizni aniqlang.
                                        </p>
                                    </div>

                                    <div className="pt-6 border-t border-white/5 mt-8">
                                        <button 
                                          disabled={!medData.name || medData.durationDays < 1}
                                          onClick={handleAssign} 
                                          className="w-full py-5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-2xl font-black text-lg shadow-[0_10px_40px_rgba(6,182,212,0.3)] hover:shadow-[0_15px_50px_rgba(6,182,212,0.4)] hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale disabled:hover:translate-y-0"
                                        >
                                          <PlusCircle className="w-6 h-6" /> Retseptni Saqlash va Yuborish
                                        </button>
                                        <p className="text-center text-xs text-zinc-500 font-bold uppercase mt-4 flex items-center justify-center gap-2">
                                            <Activity className="w-4 h-4 text-green-500" /> Bemorga avtomatik tarzda Telegram va Ilova orqali bildirishnoma ketadi.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )) : activeTab === 'videos' ? (
                <div className="space-y-8 animate-in fade-in duration-500">
                    <div className="glass-panel p-8 rounded-3xl relative">
                       <h3 className="text-2xl font-black mb-6 text-white flex items-center gap-3">
                           <Video className="w-6 h-6 text-cyan-400" strokeWidth={2.5} /> {editingVideoId ? "Video darsni tahrirlash" : "Yangi video dars qo'shish"}
                       </h3>
                       <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest pl-1">Sarlavha (UZ)</label>
                                <input value={videoForm.titleUz} onChange={e => setVideoForm({...videoForm, titleUz: e.target.value})} placeholder="Sarlavha (UZ)" className="w-full p-4 bg-black/40 rounded-2xl border border-white/5 outline-none focus:ring-2 focus:ring-cyan-500/50 text-white" />
                             </div>
                             <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest pl-1">Sarlavha (RU)</label>
                                <input value={videoForm.titleRu} onChange={e => setVideoForm({...videoForm, titleRu: e.target.value})} placeholder="Sarlavha (RU)" className="w-full p-4 bg-black/40 rounded-2xl border border-white/5 outline-none focus:ring-2 focus:ring-cyan-500/50 text-white" />
                             </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest pl-1">Tavsif (UZ)</label>
                                <textarea value={videoForm.descriptionUz} onChange={e => setVideoForm({...videoForm, descriptionUz: e.target.value})} placeholder="Tavsif (UZ)" className="w-full p-4 bg-black/40 rounded-2xl border border-white/5 outline-none focus:ring-2 focus:ring-cyan-500/50 text-white h-32" />
                             </div>
                             <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest pl-1">Tavsif (RU)</label>
                                <textarea value={videoForm.descriptionRu} onChange={e => setVideoForm({...videoForm, descriptionRu: e.target.value})} placeholder="Tavsif (RU)" className="w-full p-4 bg-black/40 rounded-2xl border border-white/5 outline-none focus:ring-2 focus:ring-cyan-500/50 text-white h-32" />
                             </div>
                          </div>

                          <div className="space-y-2">
                             <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest pl-1">YouTube Video URL</label>
                             <input value={videoForm.videoUrl} onChange={e => setVideoForm({...videoForm, videoUrl: e.target.value})} placeholder="https://www.youtube.com/watch?v=..." className="w-full p-4 bg-black/40 rounded-2xl border border-white/5 outline-none focus:ring-2 focus:ring-cyan-500/50 text-white" />
                          </div>

                           {/* Video Quiz Builder */}
                           <div className="p-6 bg-black/20 rounded-2xl border border-white/5 space-y-6">
                               <div className="flex items-center justify-between">
                                  <h4 className="text-xl font-black text-white flex items-center gap-2">
                                     <Clock className="w-5 h-5 text-yellow-500" /> Video testi (MCQ)
                                  </h4>
                                  <button onClick={addVideoQuizQuestion} className="px-4 py-2 bg-yellow-500/10 text-yellow-500 rounded-lg text-xs font-black hover:bg-yellow-500 hover:text-black transition-all">
                                     + Savol qo'shish
                                  </button>
                               </div>

                               <div className="space-y-8">
                                  {videoForm.quiz?.map((q, qIdx) => (
                                      <div key={qIdx} className="p-6 bg-white/5 rounded-2xl border border-white/5 relative group">
                                          <button onClick={() => removeVideoQuizQuestion(qIdx)} className="absolute top-4 right-4 text-zinc-500 hover:text-red-500 transition-colors">
                                              <Trash2 className="w-4 h-4" />
                                          </button>
                                          
                                          <div className="space-y-4">
                                              <p className="text-xs font-black text-zinc-500 uppercase">Savol #{qIdx + 1}</p>
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                  <input value={q.question.uz} onChange={e => updateVideoQuizQuestion(qIdx, 'question', e.target.value, 'uz')} placeholder="Savol (UZ)" className="w-full p-3 bg-black/40 rounded-xl border border-white/5 text-sm text-white" />
                                                  <input value={q.question.ru} onChange={e => updateVideoQuizQuestion(qIdx, 'question', e.target.value, 'ru')} placeholder="Savol (RU)" className="w-full p-3 bg-black/40 rounded-xl border border-white/5 text-sm text-white" />
                                              </div>
                                              
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                  {q.options.map((opt: any, optIdx: number) => (
                                                      <div key={optIdx} className="space-y-2">
                                                          <div className="flex items-center gap-2">
                                                              <input 
                                                                type="radio" 
                                                                name={`video_correct_${qIdx}`} 
                                                                checked={q.correctOptionIndex === optIdx}
                                                                onChange={() => updateVideoQuizQuestion(qIdx, 'correctOptionIndex', optIdx)}
                                                                className="accent-yellow-500"
                                                              />
                                                              <p className="text-[10px] font-bold text-zinc-500 uppercase">Variant #{optIdx + 1}</p>
                                                          </div>
                                                          <div className="grid grid-cols-1 gap-2">
                                                              <input value={opt.uz} onChange={e => updateVideoQuizQuestion(qIdx, 'option', e.target.value, 'uz', optIdx)} placeholder="Variant (UZ)" className="w-full p-2.5 bg-black/40 rounded-lg border border-white/5 text-xs text-white" />
                                                              <input value={opt.ru} onChange={e => updateVideoQuizQuestion(qIdx, 'option', e.target.value, 'ru', optIdx)} placeholder="Variant (RU)" className="w-full p-2.5 bg-black/40 rounded-lg border border-white/5 text-xs text-white" />
                                                          </div>
                                                      </div>
                                                  ))}
                                              </div>
                                          </div>
                                      </div>
                                  ))}
                                  {videoForm.quiz?.length === 0 && (
                                      <p className="text-sm text-zinc-500 text-center py-4 font-bold">Ushbu video uchun testlar qo'shilmagan</p>
                                  )}
                               </div>
                           </div>
                          
                          <div className="flex items-center gap-4">
                              <button onClick={handleSaveVideo} className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl font-black shadow-lg flex items-center justify-center gap-2 hover:opacity-90 transition-all">
                                 {editingVideoId ? <Edit2 className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />} 
                                 {editingVideoId ? "Darsni Yangilash" : "Darsni Saqlash"}
                              </button>
                               {editingVideoId && (
                                   <button onClick={() => {
                                       setEditingVideoId(null);
                                       setVideoForm({
                                           titleUz: '', titleRu: '', titleEn: '', titleUzCyrl: '',
                                           descriptionUz: '', descriptionRu: '', descriptionEn: '', descriptionUzCyrl: '',
                                           videoUrl: '', quiz: []
                                       });
                                   }} className="px-8 py-4 bg-white/5 hover:bg-white/10 rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                                       Bekor qilish
                                   </button>
                               )}
                          </div>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                       {videos.map((item) => (
                          <div key={item.id} className="glass-panel rounded-3xl overflow-hidden group">
                             <div className="aspect-video bg-black/40 relative overflow-hidden">
                                {item.iframeCode ? (
                                   <div className="w-full h-full pointer-events-none" dangerouslySetInnerHTML={{ __html: item.iframeCode }} />
                                ) : (
                                   <div className="w-full h-full flex items-center justify-center">
                                      <Video className="w-10 h-10 text-cyan-500/40" />
                                   </div>
                                )}
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                             </div>
                             <div className="p-6 relative">
                                <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEditVideo(item)} className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all">
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDeleteVideo(item.id)} className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <h4 className="text-lg font-black text-white mt-1 mb-2 line-clamp-2 break-words break-all tracking-tight uppercase">{item.title.uz}</h4>
                                <p className="text-sm text-zinc-500 line-clamp-2 break-words break-all mb-4 font-medium">{item.description?.uz}</p>
                                <div className="flex items-center justify-between">
                                  <span className="px-3 py-1 bg-yellow-500/10 text-yellow-500 text-[10px] font-black rounded-full border border-yellow-500/20 uppercase tracking-widest">{item.quiz?.length || 0} Test savollari</span>
                                  <p className="text-[10px] text-zinc-600 font-bold">{new Date(item.createdAt).toLocaleDateString()}</p>
                                </div>
                             </div>
                          </div>
                       ))}
                    </div>
                </div>
            ) : activeTab === 'news' ? (
                <div className="space-y-8 animate-in fade-in duration-500">
                    <div className="glass-panel p-8 rounded-3xl relative">
                       <h3 className="text-2xl font-black mb-6 text-white flex items-center gap-3">
                           <Activity className="w-6 h-6 text-cyan-400" /> Yangilik Qo'shish
                       </h3>
                       <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <input value={newsForm.titleUz} onChange={e => setNewsForm({...newsForm, titleUz: e.target.value})} placeholder="Sarlavha (UZ)" className="w-full p-4 bg-black/40 rounded-2xl border border-white/5 outline-none focus:ring-2 focus:ring-cyan-500/50 text-white" />
                            <input value={newsForm.titleRu} onChange={e => setNewsForm({...newsForm, titleRu: e.target.value})} placeholder="Sarlavha (RU)" className="w-full p-4 bg-black/40 rounded-2xl border border-white/5 outline-none focus:ring-2 focus:ring-cyan-500/50 text-white" />
                            <input value={newsForm.titleEn} onChange={e => setNewsForm({...newsForm, titleEn: e.target.value})} placeholder="Sarlavha (EN)" className="w-full p-4 bg-black/40 rounded-2xl border border-white/5 outline-none focus:ring-2 focus:ring-cyan-500/50 text-white" />
                            <input value={newsForm.titleUzCyrl} onChange={e => setNewsForm({...newsForm, titleUzCyrl: e.target.value})} placeholder="Sarlavha (O'Z)" className="w-full p-4 bg-black/40 rounded-2xl border border-white/5 outline-none focus:ring-2 focus:ring-cyan-500/50 text-white" />
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <textarea value={newsForm.contentUz} onChange={e => setNewsForm({...newsForm, contentUz: e.target.value})} placeholder="Matn (UZ)" className="w-full p-4 bg-black/40 rounded-2xl border border-white/5 outline-none focus:ring-2 focus:ring-cyan-500/50 text-white h-32" />
                            <textarea value={newsForm.contentRu} onChange={e => setNewsForm({...newsForm, contentRu: e.target.value})} placeholder="Matn (RU)" className="w-full p-4 bg-black/40 rounded-2xl border border-white/5 outline-none focus:ring-2 focus:ring-cyan-500/50 text-white h-32" />
                            <textarea value={newsForm.contentEn} onChange={e => setNewsForm({...newsForm, contentEn: e.target.value})} placeholder="Matn (EN)" className="w-full p-4 bg-black/40 rounded-2xl border border-white/5 outline-none focus:ring-2 focus:ring-cyan-500/50 text-white h-32" />
                            <textarea value={newsForm.contentUzCyrl} onChange={e => setNewsForm({...newsForm, contentUzCyrl: e.target.value})} placeholder="Matn (O'Z)" className="w-full p-4 bg-black/40 rounded-2xl border border-white/5 outline-none focus:ring-2 focus:ring-cyan-500/50 text-white h-32" />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="relative flex items-center gap-2">
                               <input value={newsForm.imageUrl} onChange={e => setNewsForm({...newsForm, imageUrl: e.target.value})} placeholder="Rasm URL yozing yaki rasm yuklang" className="w-full p-4 bg-black/40 rounded-2xl border border-white/5 outline-none focus:ring-2 focus:ring-cyan-500/50 text-white pr-24" />
                               <label className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-400 px-3 py-1.5 rounded-xl font-bold text-xs transition-colors">
                                  Yuklash
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      const reader = new FileReader();
                                      reader.onload = (ev) => {
                                         const img = new Image();
                                         img.onload = () => {
                                            const canvas = document.createElement('canvas');
                                            let w = img.width; let h = img.height;
                                            if (w > 800) { h = Math.round(h * 800 / w); w = 800; }
                                            if (h > 800) { w = Math.round(w * 800 / h); h = 800; }
                                            canvas.width = w; canvas.height = h;
                                            const ctx = canvas.getContext('2d');
                                            if(ctx) {
                                                ctx.drawImage(img, 0, 0, w, h);
                                                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                                                setNewsForm({...newsForm, imageUrl: dataUrl});
                                            }
                                         };
                                         img.src = ev.target?.result as string;
                                      };
                                      reader.readAsDataURL(file);
                                  }} />
                               </label>
                            </div>
                            <select value={newsForm.category} onChange={e => setNewsForm({...newsForm, category: e.target.value})} className="w-full p-4 bg-black/40 rounded-2xl border border-white/5 outline-none focus:ring-2 focus:ring-cyan-500/50 text-white appearance-none cursor-pointer">
                               <option value="general" className="bg-zinc-900">Umumiy Yangilik</option>
                               <option value="article" className="bg-zinc-900">Maqola</option>
                               <option value="announcement" className="bg-zinc-900">E'lon</option>
                            </select>
                          </div>

                           {/* Quiz Builder */}
                           <div className="p-6 bg-black/20 rounded-2xl border border-white/5 space-y-6">
                               <div className="flex items-center justify-between">
                                  <h4 className="text-xl font-black text-white flex items-center gap-2">
                                     <Clock className="w-5 h-5 text-yellow-500" /> Maqola testi (Ixtiyoriy)
                                  </h4>
                                  <button onClick={addQuizQuestion} className="px-4 py-2 bg-yellow-500/10 text-yellow-500 rounded-lg text-xs font-black hover:bg-yellow-500 hover:text-black transition-all">
                                     + Savol qo'shish
                                  </button>
                               </div>

                               <div className="space-y-8">
                                  {newsForm.quiz?.map((q, qIdx) => (
                                      <div key={qIdx} className="p-6 bg-white/5 rounded-2xl border border-white/5 relative group">
                                          <button onClick={() => removeQuizQuestion(qIdx)} className="absolute top-4 right-4 text-zinc-500 hover:text-red-500 transition-colors">
                                              <Trash2 className="w-4 h-4" />
                                          </button>
                                          
                                          <div className="space-y-4">
                                              <p className="text-xs font-black text-zinc-500 uppercase">Savol #{qIdx + 1}</p>
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                  <input value={q.question.uz} onChange={e => updateQuizQuestion(qIdx, 'question', e.target.value, 'uz')} placeholder="Savol (UZ)" className="w-full p-3 bg-black/40 rounded-xl border border-white/5 text-sm text-white" />
                                                  <input value={q.question.ru} onChange={e => updateQuizQuestion(qIdx, 'question', e.target.value, 'ru')} placeholder="Savol (RU)" className="w-full p-3 bg-black/40 rounded-xl border border-white/5 text-sm text-white" />
                                              </div>
                                              
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                  {q.options.map((opt: any, optIdx: number) => (
                                                      <div key={optIdx} className="space-y-2">
                                                          <div className="flex items-center gap-2">
                                                              <input 
                                                                type="radio" 
                                                                name={`correct_${qIdx}`} 
                                                                checked={q.correctOptionIndex === optIdx}
                                                                onChange={() => updateQuizQuestion(qIdx, 'correctOptionIndex', optIdx)}
                                                                className="accent-yellow-500"
                                                              />
                                                              <p className="text-[10px] font-bold text-zinc-500 uppercase">Variant #{optIdx + 1}</p>
                                                          </div>
                                                          <div className="grid grid-cols-1 gap-2">
                                                              <input value={opt.uz} onChange={e => updateQuizQuestion(qIdx, 'option', e.target.value, 'uz', optIdx)} placeholder="Variant (UZ)" className="w-full p-2.5 bg-black/40 rounded-lg border border-white/5 text-xs text-white" />
                                                              <input value={opt.ru} onChange={e => updateQuizQuestion(qIdx, 'option', e.target.value, 'ru', optIdx)} placeholder="Variant (RU)" className="w-full p-2.5 bg-black/40 rounded-lg border border-white/5 text-xs text-white" />
                                                          </div>
                                                      </div>
                                                  ))}
                                              </div>
                                          </div>
                                      </div>
                                  ))}
                                  {newsForm.quiz?.length === 0 && (
                                      <p className="text-sm text-zinc-500 text-center py-4 font-bold">Ushbu maqola uchun testlar qo'shilmagan</p>
                                  )}
                               </div>
                           </div>
                          
                          <div className="flex items-center gap-4">
                              <button onClick={handleSaveNews} className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-xl font-black shadow-lg flex items-center justify-center gap-2 hover:opacity-90 transition-all">
                                 {editingNewsId ? <Edit2 className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />} 
                                 {editingNewsId ? "Yangilash" : "Saqlash"}
                              </button>
                               {editingNewsId && (
                                   <button onClick={() => {
                                       setEditingNewsId(null);
                                       setNewsForm({
                                           titleUz: '', titleRu: '', titleEn: '', titleUzCyrl: '',
                                           contentUz: '', contentRu: '', contentEn: '', contentUzCyrl: '',
                                           imageUrl: '', category: 'general', quiz: []
                                       });
                                   }} className="px-8 py-4 bg-white/5 hover:bg-white/10 rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                                       Bekor qilish
                                   </button>
                               )}
                          </div>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                       {news.map((item) => (
                          <div key={item.id} className="glass-panel rounded-3xl overflow-hidden group">
                             {item.imageUrl ? (
                                <img src={item.imageUrl} alt="News Image" className="w-full h-48 object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                             ) : (
                                <div className="w-full h-48 bg-black/20 flex items-center justify-center">
                                   <Activity className="w-10 h-10 text-cyan-500/40" />
                                </div>
                             )}
                             <div className="p-6 relative">
                               <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button onClick={() => handleEditNews(item)} className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all">
                                     <Edit2 className="w-4 h-4" />
                                   </button>
                                   <button onClick={() => handleDeleteNews(item.id)} className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                                     <Trash2 className="w-4 h-4" />
                                   </button>
                               </div>
                               <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">{item.category}</span>
                               <h4 className="text-lg font-black text-white mt-2 mb-2 line-clamp-2 break-words break-all">{item.title.uz}</h4>
                               <p className="text-sm text-zinc-500 line-clamp-3 break-words break-all">{item.content.uz}</p>
                               <p className="text-xs text-zinc-600 mt-4 font-bold">{new Date(item.createdAt).toLocaleDateString()}</p>
                             </div>
                          </div>
                       ))}
                    </div>
                </div>
            ) : activeTab === 'settings' ? (
                <div className="space-y-8 animate-in fade-in duration-500">
                    <div className="glass-panel p-8 rounded-3xl">
                        <h3 className="text-2xl font-black mb-6 text-white flex items-center gap-3">
                            <ShieldCheck className="w-6 h-6 text-cyan-400" /> Platforma Sozlamalari
                        </h3>
                        <p className="text-zinc-500 text-sm max-w-xl leading-relaxed mb-8">
                            Ushbu bo'limda siz platformaning global sozlamalarini boshqarishingiz mumkin. Hozirda bu funksiya ishlab chiqilmoqda.
                        </p>
                        
                        <div className="space-y-4">
                            <div className="p-6 bg-black/20 rounded-2xl border border-white/5 flex items-center justify-between">
                                <div>
                                    <h4 className="text-white font-bold mb-1">Telegram Bot API</h4>
                                    <p className="text-zinc-500 text-sm">Bot orqali xabarnomalar yuborish uchun API Token</p>
                                </div>
                                <button className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold transition-all">Sozlash</button>
                            </div>
                            <div className="p-6 bg-black/20 rounded-2xl border border-white/5 flex items-center justify-between">
                                <div>
                                    <h4 className="text-white font-bold mb-1">Tizimni Zaxiralash</h4>
                                    <p className="text-zinc-500 text-sm">Ma'lumotlar bazasi zaxira nusxalarini arxivlash va yuklab olish</p>
                                </div>
                                <button className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold transition-all">Boshqarish</button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
      </div>
    </div>
  );
}
