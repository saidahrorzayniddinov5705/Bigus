// Shop catalogue, shared by the patient page (display) and the server (the
// server is what actually checks the price and the patient's balance).
export interface ShopItem { id: string; nameKey: string; price: number; img: string; }

export const SHOP_ITEMS: ShopItem[] = [
  { id: '2', nameKey: 'notebook', price: 2500, img: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=400' },
  { id: '3', nameKey: 'cap', price: 5000, img: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&q=80&w=400' },
  { id: '4', nameKey: 'tshirt', price: 12000, img: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&q=80&w=400' },
  { id: '5', nameKey: 'polyclinicDiscount', price: 25000, img: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=400' },
  { id: '6', nameKey: 'polyclinicDiscount', price: 30000, img: 'https://images.unsplash.com/photo-1638202993928-7267aad84c31?auto=format&fit=crop&q=80&w=400' },
  { id: '7', nameKey: 'sanatoriumVoucher', price: 50000, img: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&q=80&w=400' },
  { id: '8', nameKey: 'sanatoriumVoucher', price: 60000, img: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=400' },
  { id: '9', nameKey: 'sanatoriumVoucher', price: 70000, img: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&q=80&w=400' },
];

// Daily caps for non-medication rewards (enforced on the server).
export const REWARD_LIMITS = {
  gamesPerDay: 100,
  walkGiftsPerDay: 3,
  walkGiftMax: 25,
  walkComplete: 30,
  videoQuiz: 50,
  newsQuizPerCorrect: 5,
};
