import { useEffect, useRef, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { PashuAvatar } from './components/PashuAvatar';
import { ShopModal } from './components/ShopModal';
import { ItemType } from './types';
import { useUserStore } from './stores/useUserStore';
import { init, miniApp, hapticFeedback, initData } from '@telegram-apps/sdk-react';
import { SLOT_POSITIONS } from './utils/constants';
import { toPng } from 'html-to-image';
import { starsTransferApi, workApi, WorkCardModel, UserWorkModel } from './services/api';

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
  const [earnOpen, setEarnOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [recipientTelegramId, setRecipientTelegramId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [nowTs, setNowTs] = useState(Date.now());
  const [processingWorkId, setProcessingWorkId] = useState<string | null>(null);
  const [workCards, setWorkCards] = useState<WorkCardModel[]>([]);
  const [ownedWorks, setOwnedWorks] = useState<UserWorkModel[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [selectedItemType, setSelectedItemType] = useState<ItemType | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isReady && telegramId) {
      fetchUser(telegramId).catch(() => {
        // Если пользователь не найден, создаем нового
        console.log('User not found, creating new user');
        createUser();
      });
    }
  }, [isReady, fetchUser, createUser, telegramId]);

  useEffect(() => {
    if (!earnOpen) return;
    const id = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [earnOpen]);

  useEffect(() => {
    if (!user?.telegramId) return;
    const loadJobs = async () => {
      setJobsLoading(true);
      try {
        const [cards, userWorks] = await Promise.all([
          workApi.getWorkCards(),
          workApi.getUserWorks(user.telegramId),
        ]);
        setWorkCards(cards);
        setOwnedWorks(userWorks);
      } catch (e: any) {
        toast.error(e.message || 'Не удалось загрузить раздел работ');
      } finally {
        setJobsLoading(false);
      }
    };

    loadJobs();
  }, [user?.telegramId]);

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
    const loadingToast = toast.loading('Готовим PNG...');

    try {
      if (!captureRef.current) {
        throw new Error('Не найдена область для сохранения PNG');
      }

      const dataUrl = await toPng(captureRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#1a1a1a',
      });

      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `pashu-${Date.now()}.png`, { type: 'image/png' });

      const canShareFiles =
        typeof navigator !== 'undefined' &&
        'canShare' in navigator &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] });

      if (canShareFiles && 'share' in navigator) {
        await navigator.share({
          files: [file],
          title: 'Мой Паша Дуров',
          text: 'Мой Паша Дуров из игры',
        });
      } else {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `pashu-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast('PNG сохранен. Теперь отправь его в Telegram.');
      }
    } catch (error) {
      console.error('share png failed:', error);
      toast.error('Не удалось подготовить PNG');
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const getOwnedWork = (workCardId: string) => ownedWorks.find(work => work.workCardId === workCardId);

  const getPendingWorkIncome = (workCardId: string, profitPerHour: number) => {
    const owned = getOwnedWork(workCardId);
    if (!owned) return 0;
    const diffMs = Math.max(0, nowTs - owned.lastClaimAt);
    return Math.floor((diffMs / 3600000) * profitPerHour);
  };

  const handleBuyWork = async (work: WorkCardModel) => {
    if (!user) return;
    if (getOwnedWork(work.id)) {
      toast('Эта работа уже куплена');
      return;
    }
    if (user.stars < work.unlockPrice) {
      toast.error(`Недостаточно звёзд. Нужно ${work.unlockPrice} ⭐`);
      return;
    }

    setProcessingWorkId(work.id);
    try {
      await workApi.purchaseWork(work.id);
      const userWorks = await workApi.getUserWorks(user.telegramId);
      setOwnedWorks(userWorks);
      await fetchUser(user.telegramId);
      toast.success(`Работа "${work.title}" разблокирована`);
    } catch (e: any) {
      toast.error(e.message || 'Не удалось купить работу');
    } finally {
      setProcessingWorkId(null);
    }
  };

  const handleClaimWorkIncome = async (work: WorkCardModel) => {
    if (!user) return;
    if (!getOwnedWork(work.id)) return;

    setProcessingWorkId(work.id);
    try {
      const earned = await workApi.claimIncome(work.id);
      const userWorks = await workApi.getUserWorks(user.telegramId);
      setOwnedWorks(userWorks);
      await fetchUser(user.telegramId);
      toast.success(`+${earned} ⭐ начислено`);
    } catch (e: any) {
      toast.error(e.message || 'Не удалось начислить доход');
    } finally {
      setProcessingWorkId(null);
    }
  };

  const handleTransferStars = async () => {
    if (!user) return;
    if (transferLoading) return;

    setTransferLoading(true);
    try {
      const amount = Number(transferAmount);
      await starsTransferApi.transferByTelegramId(recipientTelegramId, amount, transferNote);
      await fetchUser(user.telegramId);
      toast.success(`Перевод ${Math.floor(amount)} ⭐ выполнен`);
      setTransferOpen(false);
      setRecipientTelegramId('');
      setTransferAmount('');
      setTransferNote('');
    } catch (e: any) {
      toast.error(e.message || 'Не удалось выполнить перевод');
    } finally {
      setTransferLoading(false);
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
        <div className="px-4 pt-[calc(2.25rem+env(safe-area-inset-top))] pb-4 flex items-center justify-between gap-3">
          <div className="text-sm bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-2.5 shadow-lg">
            <div className="text-slate-300">ID: <span className="text-cyan-300 font-semibold">{user.telegramId}</span></div>
            <div className="text-slate-300">Баланс: <span className="text-yellow-300 font-semibold">{user.stars} ⭐</span></div>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setEarnOpen(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-5 py-2.5 rounded-xl text-lg leading-none"
            >
              Заработать
            </button>
            <button
              onClick={() => setTransferOpen(true)}
              className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-4 py-2 rounded-xl text-sm leading-none"
            >
              Отправить ⭐
            </button>
          </div>
        </div>

        {/* Аватар Паши - занимает всё свободное место */}
        <div className="flex-1 w-full h-full">
          <PashuAvatar user={user} onSlotClick={handleSlotClick} captureRef={captureRef} />
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

      {earnOpen && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end">
          <div className="w-full bg-slate-900 rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Заработать ⭐</h3>
              <button onClick={() => setEarnOpen(false)} className="text-xl">✕</button>
            </div>
            <div>
              <p className="text-sm text-slate-300 mb-4">
                Разблокируй работу за звезды и собирай прибыль в час, как в Hamster-механике.
              </p>
              {jobsLoading && (
                <div className="text-sm text-slate-300 mb-3">Загрузка работ...</div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {workCards.map((work) => {
                  const owned = getOwnedWork(work.id);
                  const pendingIncome = getPendingWorkIncome(work.id, work.profitPerHour);

                  return (
                    <div key={work.id} className="rounded-xl bg-slate-800 p-3 border border-slate-700">
                      <div className="w-full h-20 rounded-lg overflow-hidden bg-slate-700 mb-2 flex items-center justify-center">
                        {work.imageUrl ? (
                          <img
                            src={work.imageUrl}
                            alt={work.title}
                            className="w-full h-full object-cover"
                            onError={(event) => {
                              event.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className="text-2xl">💼</span>
                        )}
                      </div>
                      <div className="text-sm font-bold">{work.title}</div>
                      <div className="text-[11px] text-slate-400">{work.description}</div>
                      <div className="text-xs text-yellow-300 mt-2">Прибыль в час: +{work.profitPerHour} ⭐</div>
                      <div className="text-xs text-slate-400 mt-1">
                        {owned ? `lvl 1 · накоплено: ${pendingIncome} ⭐` : `Unlock: ${work.unlockPrice} ⭐`}
                      </div>
                      <button
                        onClick={() => (owned ? handleClaimWorkIncome(work) : handleBuyWork(work))}
                        disabled={processingWorkId === work.id}
                        className={`w-full mt-2 py-2 rounded-lg font-semibold ${
                          owned
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                            : 'bg-cyan-500 hover:bg-cyan-400 text-black'
                        } disabled:bg-slate-600 disabled:text-slate-300`}
                      >
                        {processingWorkId === work.id
                          ? 'Обработка...'
                          : owned
                            ? `Забрать +${pendingIncome} ⭐`
                            : `Купить за ${work.unlockPrice} ⭐`}
                      </button>
                    </div>
                  );
                })}
              </div>
              {!jobsLoading && workCards.length === 0 && (
                <div className="text-sm text-slate-400 mt-2">Работы пока не настроены в базе.</div>
              )}
              <p className="text-xs text-slate-400 mt-3">
                Изображения работ можно класть в `client/public/works/`.
              </p>
            </div>
          </div>
        </div>
      )}

      {transferOpen && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-end">
          <div className="w-full bg-slate-900 rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Перевод звёзд ⭐</h3>
              <button onClick={() => setTransferOpen(false)} className="text-xl">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Telegram ID получателя</label>
                <input
                  value={recipientTelegramId}
                  onChange={(event) => setRecipientTelegramId(event.target.value.replace(/[^\d]/g, ''))}
                  inputMode="numeric"
                  placeholder="Например: 123456789"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">Сумма ⭐</label>
                <input
                  value={transferAmount}
                  onChange={(event) => setTransferAmount(event.target.value.replace(/[^\d]/g, ''))}
                  inputMode="numeric"
                  placeholder="Например: 50"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">Комментарий (опционально)</label>
                <input
                  value={transferNote}
                  onChange={(event) => setTransferNote(event.target.value)}
                  placeholder="За помощь / подарок"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <button
                onClick={handleTransferStars}
                disabled={transferLoading || !recipientTelegramId || !transferAmount}
                className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:bg-slate-600 disabled:text-slate-300 text-black font-bold py-3 rounded-lg"
              >
                {transferLoading ? 'Отправляем...' : 'Отправить звезды'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
