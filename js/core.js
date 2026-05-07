document.addEventListener('contextmenu', e => e.preventDefault());

const DEFAULT_JOIN_LEVELS = {"Abelard": 1, "Idira": 1, "Argenta": 3, "Pasqal": 6, "Cassia": 10, "Heinrix": 12, "Yrliet": 14, "Jae": 16, "Ulfar": 22, "Marazhai": 31, "Kibellah": 33, "Solomorne": 37, "Incendia Chorda": 40, "Calligos Winterscale": 40, "Uralon": 40};

const $ = (id) => document.getElementById(id);

const COMPANION_ARCH = {
  'Abelard': 'Warrior', 'Idira': 'Operative', 'Argenta': 'Soldier',
  'Cassia': 'Officer', 'Pasqal': 'Operative', 'Heinrix': 'Warrior',
  'Jae': 'Officer', 'Yrliet': 'Operative', 'Ulfar': 'Soldier',
  'Marazhai': 'Warrior', 'Kibellah': 'Bladedancer', 'Solomorne': 'Soldier',
  'Incendia Chorda': 'Soldier', 'Calligos Winterscale': 'Warrior', 'Uralon': 'Officer'
};
const COMPANION_ORDER = [
  'Abelard','Idira','Argenta','Cassia','Pasqal','Heinrix','Jae','Yrliet',
  'Ulfar','Marazhai','Kibellah','Solomorne','Incendia Chorda','Calligos Winterscale','Uralon'
];
