import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';

interface UserData {
  uid: string;
  fullName: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  birthDate: string;
  role: 'patient' | 'doctor';
  isProfileComplete: boolean;
  [key: string]: any;
}

interface AuthContextType {
  currentUser: { uid: string } | null;
  userData: UserData | null;
  loading: boolean;
  registerPatient: (data: Omit<UserData, 'uid' | 'role' | 'isProfileComplete'>) => Promise<string>;
  loginAdmin: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

const getPatientId = () => {
  let id = localStorage.getItem('patientId');
  if (!id) {
    const match = document.cookie.match(new RegExp('(^| )patientId=([^;]+)'));
    if (match) id = match[2];
  }
  return id;
};

const setPatientId = (id: string | null) => {
  if (id) {
    localStorage.setItem('patientId', id);
    document.cookie = `patientId=${id}; max-age=${60 * 60 * 24 * 365}; path=/`; // 1 year
  } else {
    localStorage.removeItem('patientId');
    document.cookie = `patientId=; max-age=0; path=/`;
  }
};

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<{ uid: string } | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for admin session
    if (localStorage.getItem('isAdminSession') === 'true') {
        setUserData({ role: 'doctor', fullName: 'System Admin' } as any);
        setLoading(false);
        return;
    }

    // Check for patient session
    const patientId = getPatientId();
    if (patientId) {
        setCurrentUser({ uid: patientId });
        const docRef = doc(db, 'users', patientId);
        onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserData(docSnap.data() as UserData);
          } else {
            setPatientId(null);
            setCurrentUser(null);
            setUserData(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("User data snapshot error:", error);
          setLoading(false);
        });
    } else {
        setLoading(false);
    }
  }, []);

  const loginAdmin = async (email: string, password: string) => {
    if (email === 'admin@gmail.com' && password === 'admin12345!') {
        localStorage.setItem('isAdminSession', 'true');
        setUserData({ role: 'doctor', fullName: 'System Admin' } as any);
        return true;
    }
    return false;
  };

  const registerPatient = async (data: Omit<UserData, 'uid' | 'role' | 'isProfileComplete'>) => {
    // Search for existing user based on identical basic info
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef, 
      where('role', '==', 'patient'),
      where('birthDate', '==', data.birthDate)
    );
    
    try {
      const querySnapshot = await getDocs(q);
      
      const existingDoc = querySnapshot.docs.find(doc => {
        const d = doc.data();
        const firstMatch = (d.firstName || '').trim().toLowerCase() === (data.firstName || '').trim().toLowerCase();
        const lastMatch = (d.lastName || '').trim().toLowerCase() === (data.lastName || '').trim().toLowerCase();
        const fatherMatch = (d.fatherName || '').trim().toLowerCase() === (data.fatherName || '').trim().toLowerCase();
        console.log("Checking match:", firstMatch, lastMatch, fatherMatch, d);
        return firstMatch && lastMatch && fatherMatch;
      });

      if (existingDoc) {
        // User already exists! Log them in.
        const existingData = existingDoc.data() as UserData;
        const existingUid = existingDoc.id;
        
        // Optimistic UI updates
        setPatientId(existingUid);
        setCurrentUser({ uid: existingUid });
        setUserData({ ...existingData, ...data, isProfileComplete: true });

        // Update any changed fields in background
        updateDoc(doc(db, 'users', existingUid), {
          fatherName: data.fatherName,
          telegramUsername: data.telegramUsername || '',
          fullName: data.fullName
        }).catch(console.error);

        return existingUid;
      }
    } catch (e) {
      console.error("Error checking existing user:", e);
    }

    const newUid = crypto.randomUUID();
    const newData = {
        uid: newUid,
        ...data,
        role: 'patient',
        isProfileComplete: true,
        createdAt: Date.now(),
        hCoins: 0,
        xp: 0,
        level: 1,
        streak: 0
    } as unknown as UserData;
    
    // Optimistic UI updates
    setPatientId(newUid);
    setCurrentUser({ uid: newUid });
    setUserData(newData);
    
    setDoc(doc(db, 'users', newUid), newData).catch(console.error);
    return newUid;
  };

  const logout = async () => {
    localStorage.removeItem('isAdminSession');
    setPatientId(null);
    setCurrentUser(null);
    setUserData(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, userData, loading, registerPatient, loginAdmin, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
