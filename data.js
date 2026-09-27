// ============================================================
//  СИДОВЫЕ ДАННЫЕ КОЛЛЕКЦИИ
//
//  Это стартовый набор банок: server.js читает этот файл и
//  выдаёт перечисленные банки каждому новому аккаунту при
//  регистрации. Дальше коллекция пользователя живёт в базе
//  SQLite на сервере и меняется через интерфейс (добавление,
//  удаление, оценки) — правки этого файла затронут только
//  будущие аккаунты. Фото загружаются через форму приложения,
//  поле image здесь больше не используется.
// ============================================================

window.CAN_COLLECTION = [
  {
    id: 'monster-ultra-white',
    number: 1,
    brand: 'Monster Energy',
    flavor: 'Ultra White',
    country: 'США',
    volume: '500 мл',
    date: '2024-11-02',
    notes: 'Самый нейтральный из серии Ultra: лёгкий цитрус без приторности. Хорош как база, но без яркого характера.',
    color: '#BFC5CC'
  },
  {
    id: 'red-bull-red-edition',
    number: 2,
    brand: 'Red Bull',
    flavor: 'Red Edition — Арбуз',
    country: 'Австрия',
    volume: '355 мл',
    date: '2025-01-18',
    notes: 'Арбуз заметен, но ненавязчив. Газации чуть меньше, чем в классике. Красивая банка.',
    color: '#B23A48'
  },
  {
    id: 'burn-apple-kiwi',
    number: 3,
    brand: 'Burn',
    flavor: 'Apple & Kiwi',
    country: 'Польша',
    volume: '500 мл',
    date: null,
    notes: '',
    color: '#3F7D3B'
  },
  {
    id: 'adrenaline-rush-original',
    number: 4,
    brand: 'Adrenaline Rush',
    flavor: 'Original',
    country: 'Россия',
    volume: '450 мл',
    date: '2023-09-05',
    notes: 'Вкус из школьных времён. Сладковато-яблочный, густая газация. Оценка скорее ностальгическая.',
    color: '#D95A2B'
  },
  {
    id: 'gorilla-blue-raspberry',
    number: 5,
    brand: 'Gorilla',
    flavor: 'Blue Raspberry',
    country: 'Россия',
    volume: '450 мл',
    date: '2025-03-30',
    notes: 'Синяя малина, как газировка из автомата. Слишком сладко, но холодным заходит.',
    color: '#2C5FA8'
  },
  {
    id: 'celsius-sparkling-orange',
    number: 6,
    brand: 'Celsius',
    flavor: 'Sparkling Orange',
    country: 'США',
    volume: '330 мл',
    date: '2025-05-12',
    notes: 'Апельсин ближе к апельсиновой содовой, чем к соку. Приятная лёгкость, мало сахара.',
    color: '#DD6F33'
  },
  {
    id: 'lipovitan-d-classic',
    number: 7,
    brand: 'Lipovitan D',
    flavor: 'Classic',
    country: 'Япония',
    volume: '220 мл',
    date: null,
    notes: '',
    color: '#B9942F'
  },
  {
    id: 'v-energy-green',
    number: 8,
    brand: 'V Energy',
    flavor: 'Green',
    country: 'Новая Зеландия',
    volume: '500 мл',
    date: '2024-06-21',
    notes: 'Цитрус с гуараной, очень ровный вкус. Один из лучших «зелёных» в коллекции.',
    color: '#1D9E6B'
  },
  {
    id: 'tiger-sugar-free',
    number: 9,
    brand: 'Tiger',
    flavor: 'Sugar Free',
    country: 'Таиланд',
    volume: '330 мл',
    date: '2025-07-04',
    notes: 'Для «без сахара» — на удивление полноценный вкус. Чуть химичит в послевкусии.',
    color: '#E4B81F'
  },
  {
    id: 'nocco-caribbean',
    number: 10,
    brand: 'NOCCO',
    flavor: 'Caribbean',
    country: 'Швеция',
    volume: '330 мл',
    date: '2025-08-09',
    notes: 'Тропическая смесь: ананас и маракуйя. Пьётся как лимонад, бодрит заметно.',
    color: '#1B8F86'
  }
];
