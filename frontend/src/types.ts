export type MenuItem = {
  id: number;
  name: string;
  price: number;
  ingredients: string;
  stock_count: number;
  image_url: string | null;
  is_available: boolean;
  cafe_name: string | null;
};

export type Cafe = {
  id: string;
  name: string;
  location: string;
  crowdLevel: 'Low' | 'Medium' | 'High';
  waitingTime: number; // in minutes
  userGroup: string;
  menuItemIds: number[]; // Mapping to backend IDs
  imageUrl: string;
};

// Simulated data for recommendation logic
export const CAFE_DATA: Cafe[] = [
  {
    id: 'forum',
    name: 'Forum Café',
    location: 'Central campus (Mount Scopus)',
    crowdLevel: 'High',
    waitingTime: 12,
    userGroup: 'General students',
    menuItemIds: [],
    imageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=800'
  },
  {
    id: 'soc-sci',
    name: 'Social Sciences Vitamin',
    location: 'Social Sciences Building',
    crowdLevel: 'Medium',
    waitingTime: 7,
    userGroup: 'Social Sciences students',
    menuItemIds: [],
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=800'
  },
  {
    id: 'hum-vit',
    name: 'Humanities Vitamin',
    location: 'Humanities Building',
    crowdLevel: 'Low',
    waitingTime: 4,
    userGroup: 'Humanities students',
    menuItemIds: [],
    imageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?q=80&w=800'
  },
  {
    id: 'rothberg',
    name: 'Rothberg Forum Café',
    location: 'Rothberg area',
    crowdLevel: 'Medium',
    waitingTime: 8,
    userGroup: 'International students',
    menuItemIds: [],
    imageUrl: 'https://images.unsplash.com/photo-1445116572660-236099ec97a0?q=80&w=800'
  }
];
