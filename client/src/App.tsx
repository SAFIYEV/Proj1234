import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { PashuAvatar } from './components/PashuAvatar';
import { ShopModal } from './components/ShopModal';
import { ItemType } from './types';
import { useUserStore } from './stores/useUserStore';
import { prepareShareMessage } from './services/api';
import { init, shareMessage, miniApp, hapticFeedback, initData } from '@telegram-apps/sdk-react';
import { SLOT_POSITIONS } from './utils/constants';

function App() {
  const [isReady, setIsReady] = useState(false);
  const [telegramId, setTelegramId] = useState<string | null>(null);

  useEffect(() => {
    console.log('init');
    init();

    // Дожидаемся инициализации перед вызовом методов
    setTimeout(() => {
      console.log('mountSync');
      try {
        miniApp.mountSync();
        // Some SDK builds do not expose expand on miniApp object.
        (window as any)?.Telegram?.WebApp?.expand?.();
        miniApp.setHeaderColor('#1a1a1a');
        miniApp.setBackgroundColor('#1a1a1a');
        initData.restore();
        const tgId = initData.user()?.id.toString() || null;
        setTelegramId(tgId);
        miniApp.ready();
      } catch (error) {
        console.warn('Telegram WebApp methods failed:', error);
      } finally {
        setIsReady(true);
      }
    }, 100);
  }, []);
  const { user, loading, error, fetchUser, createUser } = useUserStore();
  const [shopOpen, setShopOpen] = useState(false);
  const [selectedItemType, setSelectedItemType] = useState<ItemType | null>(null);

  useEffect(() => {
    if (isReady && telegramId) {
      fetchUser(telegramId).catch(() => {
        // Если пользователь не найден, создаем нового
        console.log('User not found, creating new user');
        createUser();
      });
    }
  }, [isReady, fetchUser, createUser, telegramId]);

  const handleSlotClick = (type: ItemType) => {
    hapticFeedback.impactOccurred('medium');
    setSelectedItemType(type);
    setShopOpen(true);
  };

  const handleCloseShop = () => {
    setShopOpen(false);
    setSelectedItemType(null);
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary mx-auto mb-4"></div>
          <p className="text-white text-lg">Загружаем твоего Пашу...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">😞</div>
          <h2 className="text-white text-xl font-bold mb-2">Упс!</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-primary hover:bg-red-600 text-white px-6 py-2 rounded-lg font-medium"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🎭</div>
          <h2 className="text-white text-xl font-bold mb-2">Добро пожаловать!</h2>
          <p className="text-gray-400 mb-4">
            Создай своего уникального Пашу и начни одевать его в самую крутую одежду!
          </p>
          <button 
            onClick={createUser}
            className="bg-primary hover:bg-red-600 text-white px-6 py-2 rounded-lg font-medium"
          >
            Создать Пашу
          </button>
        </div>
      </div>
    );
  }

  const dressLevel = Math.round((user.items.filter(item => item.equipped).length / SLOT_POSITIONS.length) * 100);

  // Крутость = сумма coolness всех надетых айтемов
  const coolnessLevel = user.items
    .filter(item => item.equipped)
    .reduce((acc, item) => acc + (item.item.coolness || 0), 0);


  const handleShare = async () => {
    hapticFeedback.impactOccurred('medium');
    // Пробуем использовать shareMessage как основной метод
    const loadingToast = toast.loading('Подготавливаем карточку...');
    
    try {
      prepareShareMessage()
      .then((preparedMessageId) => {
        console.log('preparedMessageId', preparedMessageId);
        shareMessage(preparedMessageId)
        .then((result) => {
          console.log('shareMessage result:', result);
        })
        .catch((error) => {
          console.error('shareMessage failed:', error);
        });
      })
      .catch((error) => {
        console.error('prepareShareMessage failed:', error);
        toast.error('Не удалось подготовить карточку. Используем обычный шаринг...');
      })
      .finally(() => {
        toast.dismiss(loadingToast);
      });

      console.log('Подготавливаем данные для шаринга...');
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error('prepareShareMessage failed:', error);
      toast.error('Не удалось подготовить карточку. Используем обычный шаринг...');
    }
  };

  return (
    <div className="min-h-[100dvh] h-[100dvh] bg-dark text-white">
      <Toaster 
        position="top-center"
        toastOptions={{
          style: {
            background: '#2a2a2a',
            color: '#ffffff',
          },
        }}
      />

      {/* Основной контент */}
      <div className="h-[100dvh] bg-dark text-white flex flex-col overflow-hidden">
        {/* Аватар Паши - занимает всё свободное место */}
        <div className="flex-1 w-full h-full">
          <PashuAvatar user={user} onSlotClick={handleSlotClick} />
        </div>

        {/* Блоки одетости и крутости - внизу */}
        <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4">
          <div className="flex justify-around text-sm">
            <div className="flex items-start gap-3">
              <span className="text-3xl">👔</span>
              <div className="text-left min-w-[80px]">
                <div className="flex items-center gap-2">
                  <span className="text-green-400 font-medium">Одетость:</span>
                  <span className="text-white font-bold">{dressLevel}%</span>
                </div>
                <div className="relative w-20 h-2 mt-1 bg-slate-800 rounded-full overflow-hidden border border-green-400/30">
                  {/* Неоновое свечение */}
                  <div className="absolute inset-0 bg-gradient-to-r from-green-400/20 to-emerald-400/20 blur-sm"></div>
                  {/* Прогресс с секторами */}
                  <div className="relative h-full flex">
                    {Array.from({ length: 5 }, (_, i) => (
                      <div key={i} className="flex-1 border-r border-green-400/20 last:border-r-0">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            i < Math.floor(dressLevel / 20) 
                              ? 'bg-gradient-to-r from-green-400 to-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.6)]' 
                              : 'bg-slate-700'
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-3xl">😎</span>
              <div className="text-left min-w-[80px]">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400 font-medium">Крутость:</span>
                  <span className="text-white font-bold">{coolnessLevel}</span>
                </div>
                <div className="relative w-20 h-2 mt-1 bg-slate-800 rounded-full overflow-hidden border border-yellow-400/30">
                  {/* Неоновое свечение */}
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 blur-sm"></div>
                  {/* Прогресс с секторами */}
                  <div className="relative h-full flex">
                    {Array.from({ length: 5 }, (_, i) => (
                      <div key={i} className="flex-1 border-r border-yellow-400/20 last:border-r-0">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            i < Math.floor((coolnessLevel % 100) / 20) 
                              ? 'bg-gradient-to-r from-yellow-400 to-orange-400 shadow-[0_0_8px_rgba(234,179,8,0.6)]' 
                              : 'bg-slate-700'
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Кнопка "показать кентам" - самый верхний слой */}
          <div className="flex justify-between">
            <button
              onClick={handleShare}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-400 hover:to-cyan-300 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 shadow-[inset_0_2px_0_rgba(255,255,255,0.4)] hover:shadow-[inset_0_2px_0_rgba(255,255,255,0.6)]"
            >
              Показать кентам
            </button>
          </div>
        </div>
      </div>

      {/* Модальное окно магазина */}
      <ShopModal 
        isOpen={shopOpen}
        itemType={selectedItemType}
        onClose={handleCloseShop}
      />
    </div>
  );
}

export default App;
