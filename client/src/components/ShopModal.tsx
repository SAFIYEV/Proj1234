import React, { useEffect, useState } from 'react';
import { Item, ItemType, ItemTier } from '../types';
import { TIER_INFO, SLOT_POSITIONS } from '../utils/constants';
import { useItemsStore } from '../stores/useItemsStore';
import { useUserStore } from '../stores/useUserStore';
import toast from 'react-hot-toast';
import { formatPrice, checkItemOwnership } from '../lib/payment';
import { paymentsApi, wearItem } from '../services/api';
import { hapticFeedback, openTelegramLink } from '@telegram-apps/sdk-react';

interface ShopModalProps {
  isOpen: boolean;
  itemType: ItemType | null;
  onClose: () => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({ isOpen, itemType, onClose }) => {
  const { fetchItemsByType, items, loading } = useItemsStore();
  const { user, fetchUser } = useUserStore();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      if (itemType) {
        fetchItemsByType(itemType);
      }
    } else {
      setIsVisible(false);
    }
  }, [isOpen, itemType, fetchItemsByType]);

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  const availableItems = items.filter(item => item.type === itemType);
  // Показываем все доступные айтемы, отсортированные по тиру и цене
  const shopItems = availableItems.sort((a, b) => {
    // Сначала сортируем по тиру (POOR -> WORKER -> RICH -> JEW)
    const tierOrder = { [ItemTier.POOR]: 0, [ItemTier.WORKER]: 1, [ItemTier.RICH]: 2, [ItemTier.JEW]: 3 };
    const tierDiff = tierOrder[a.tier] - tierOrder[b.tier];
    if (tierDiff !== 0) return tierDiff;
    // Если тир одинаковый, сортируем по цене (от дешевого к дорогому)
    return a.price - b.price;
  });

  const handlePurchase = async (item: Item) => {
    if (!user) return;
    
    if (checkItemOwnership(user, item)) {
      toast.error('У вас уже есть этот предмет!');
      return;
    }

    setPurchasing(item.id);
    hapticFeedback.impactOccurred('medium');

    try {
      const invoice = await paymentsApi.createPaymentInvoice(
        user.id,
        user.telegramId, 
        user.username || user.firstName || '', 
        item.id, 
        item.name, 
        item.price
      );
      
      if (!invoice?.invoice_url || !invoice?.payload) {
        toast.error('Не удалось создать инвойс');
        return;
      }

      // Открываем инвойс через новый SDK
      try {
        // Используем utils.openTelegramLink для открытия инвойса
        openTelegramLink(invoice.invoice_url);
        
        // Запускаем проверку платежа через некоторое время
        setTimeout(async () => {
          try {
            // Обновляем данные пользователя для проверки покупки
            await fetchUser(user.telegramId);
            
            // Проверяем, появился ли предмет у пользователя
            const updatedUser = useUserStore.getState().user;
            if (updatedUser && checkItemOwnership(updatedUser, item)) {
              handleClose();
            }
          } catch (e) {
            console.error('Error checking payment result:', e);
          }
        }, 3000);
        
      } catch (e) {
        console.error('Ошибка при открытии инвойса:', e);
        toast.error('Не удалось открыть оплату');
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
      toast.error(error.message || 'Ошибка при покупке');
    } finally {
      setPurchasing(null);
    }
  };

  const handleWear = async (item: Item) => {
    if (!user) {
      console.error('❌ [WEAR] Пользователь не найден');
      return;
    }
    
    // Проверяем, есть ли предмет у пользователя
    const userItem = user.items.find(i => i.itemId === item.id);
    
    if (!userItem) {
      console.error('❌ [WEAR] Предмет не найден у пользователя');
      toast.error('У вас нет этого предмета!');
      return;
    }
    
    if (userItem.equipped) {
      console.log('⚠️ [WEAR] Предмет уже надет');
      toast('Предмет уже надет!');
      return;
    }
    
    try {
      await wearItem(item.id);
      await fetchUser(user.telegramId);
      
      // Проверяем, что предмет действительно надет
      const updatedUser = useUserStore.getState().user;
      const updatedUserItem = updatedUser?.items.find(i => i.itemId === item.id);
      
      if (!updatedUserItem?.equipped) {
        toast.error('Предмет не отображается как надетый после обновления');
      }
    } catch (e: any) {
      console.error('💥 [WEAR] Ошибка при надевании:', e);
      console.error('💥 [WEAR] Error details:', {
        message: e.message,
        stack: e.stack,
        name: e.name
      });
      toast.error(e.message || 'Ошибка при надевании');
    }
  };

  return (
    <div className={`fixed inset-0 z-50 transition-all duration-500 ease-out ${
      isVisible ? 'bg-black/90 backdrop-blur-xl' : 'bg-black/0 backdrop-blur-0'
    }`}>
      {/* Animated backdrop */}
      <div 
        className="absolute inset-0"
        onClick={handleClose}
      />
      
      {/* Neon border effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 via-purple-500/20 to-pink-500/20" 
           style={{ opacity: isVisible ? 1 : 0 }} />
      
      {/* Stats at top of screen */}
      <div className={`absolute top-0 left-0 right-0 transition-transform duration-500 ease-out ${
        isVisible ? 'translate-y-0' : '-translate-y-8'
      }`}>
        <div className="w-full max-w-xl mx-auto mt-4">
          <div className="flex justify-around text-sm">
            <div className="flex items-start gap-3">
              <span className="text-3xl">👔</span>
              <div className="text-left min-w-[80px]">
                <div className="flex items-center gap-2">
                  <span className="text-green-400 font-medium">Одетость:</span>
                  <span className="text-white font-bold">{Math.round((user?.items?.filter(item => item.equipped).length || 0) / SLOT_POSITIONS.length * 100)}%</span>
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
                            i < Math.floor((user?.items?.filter(item => item.equipped).length || 0) / SLOT_POSITIONS.length * 100 / 20) || 0
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
                  <span className="text-white font-bold">{user?.items?.filter(item => item.equipped).reduce((total, item) => total + (item.item.coolness || 0), 0) || 0}</span>
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
                            i < Math.floor(((user?.items?.filter(item => item.equipped).reduce((total, item) => total + (item.item.coolness || 0), 0) || 0) % 100) / 20)
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
        </div>
      </div>

      {/* Modal container */}
      <div className={`absolute bottom-0 left-0 right-0 transition-transform duration-500 ease-out ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}>
        <div className="relative w-full max-w-xl mx-auto max-h-[90vh] sm:max-h-[85vh]">
          {/* Neon glow container */}
          <div className="relative bg-gradient-to-b from-slate-900 via-slate-800 to-black rounded-t-[2rem] sm:rounded-t-[2.5rem] overflow-hidden">
            {/* Animated neon border */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 rounded-t-[2rem] sm:rounded-t-[2.5rem] opacity-20 blur-sm" />
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 rounded-t-[2rem] sm:rounded-t-[2.5rem] opacity-10 blur-md" />
            
            {/* Main content */}
            <div className="relative bg-gradient-to-b from-slate-900/95 via-slate-800/95 to-black/95 backdrop-blur-xl">
              {/* Header */}
              <div className="relative p-6 sm:p-8 border-b border-cyan-400/20">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h2 className="text-lg sm:text-xl font-extrabold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                      {SLOT_POSITIONS.find(s => s.id === itemType)?.name}
                    </h2>
                    <p className="text-cyan-300/80 text-sm sm:text-base font-medium">
                      Выбери свой стиль в метавселенной
                    </p>
                  </div>
                  <button 
                    onClick={handleClose}
                    className="w-12 h-12 sm:w-14 sm:h-14 transition-all duration-300 flex items-center justify-center hover:scale-110 group"
                  >
                    <span className="text-2xl sm:text-3xl font-bold text-cyan-300 group-hover:text-cyan-200 transition-colors duration-300">×</span>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-140px)] sm:max-h-[calc(85vh-180px)]">
                {loading ? (
                  <div className="text-center py-16 sm:py-20">
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6">
                      {/* Multi-layered spinner */}
                      <div className="absolute inset-0 border-4 border-cyan-400/20 rounded-full animate-spin">
                        <div className="absolute inset-0 border-4 border-transparent border-t-cyan-400 rounded-full animate-spin"></div>
                      </div>
                      <div className="absolute inset-0 border-4 border-transparent border-t-purple-400 rounded-full animate-spin" style={{ animationDelay: '0.2s' }}></div>
                      <div className="absolute inset-0 border-4 border-transparent border-t-pink-400 rounded-full animate-spin" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                    <p className="text-cyan-300/80 text-lg sm:text-xl font-medium">Загрузка NFT предметов...</p>
                  </div>
                ) : (
                  <div className="space-y-4 sm:space-y-5">
                    {/* Items */}
                    {shopItems.map((item, index) => {
                      const tierInfo = TIER_INFO[item.tier];
                      const userItem = user?.items.find(i => i.itemId === item.id);
                      const isOwned = !!userItem;
                      const isEquipped = !!userItem && userItem.equipped;
                      const isPurchasing = purchasing === item.id;
                      
                      return (
                        <div 
                          key={item.id}
                          className={`transform transition-all duration-500 ease-out ${
                            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
                          }`}
                          style={{ 
                            transitionDelay: `${index * 100}ms`,
                          }}
                        >
                          <div 
                            className="group relative bg-gradient-to-br from-slate-800/60 via-slate-700/40 to-slate-800/60 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-3 sm:p-4 border-2 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl"
                            style={{ 
                              borderColor: `${tierInfo.color}40`,
                              boxShadow: `0 0 30px ${tierInfo.color}20`
                            }}
                          >
                            {/* Hover glow effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/5 via-purple-400/5 to-pink-400/5 rounded-2xl sm:rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            
                            <div className="relative flex items-center gap-2.5 sm:gap-3">
                              {/* Item Image - Left */}
                              <div className="w-14 h-14 sm:w-18 sm:h-18 flex-shrink-0 rounded-2xl flex items-center justify-center overflow-hidden">
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    className="w-full h-full object-contain rounded-2xl"
                                  />
                                ) : (
                                  <div className="text-xl sm:text-2xl">🎭</div>
                                )}
                              </div>
                              
                              {/* Item Info - Center */}
                              <div className="flex-1 min-w-0">
                                {/* Name */}
                                <h3 className="font-semibold text-white text-sm sm:text-base mb-1.5" style={{ fontFamily: 'Roboto Condensed, sans-serif' }}>{item.name}</h3>
                                
                                {/* Quality and Price in one row */}
                                <div className="flex items-center gap-2.5 mb-2">
                                  <span 
                                    className="px-2.5 py-1 rounded-full text-xs font-semibold text-white shadow-lg whitespace-nowrap"
                                    style={{ 
                                      backgroundColor: tierInfo.color,
                                      boxShadow: `0 0 20px ${tierInfo.color}40`,
                                      fontFamily: 'Roboto Condensed, sans-serif'
                                    }}
                                  >
                                    {tierInfo.name}
                                  </span>
                                </div>

                                {/* Stats row */}
                                <div className="flex items-center gap-4 text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-green-400">👔</span>
                                    <span className="text-white/80">+{item.weared || 0}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-yellow-400">😎</span>
                                    <span className="text-white/80">+{item.coolness || 0}</span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Action Button - Right */}
                              <div className="flex-shrink-0">
                                {isOwned ? (
                                  isEquipped ? (
                                    <button
                                      disabled
                                      className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-semibold text-sm sm:text-base bg-gradient-to-r from-slate-600 to-slate-700 text-slate-300 cursor-not-allowed transition-all duration-200 border border-slate-500/30"
                                      style={{ fontFamily: 'Roboto Condensed, sans-serif' }}
                                    >
                                      Надето
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleWear(item)}
                                      className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-semibold text-sm sm:text-base bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:from-cyan-400 hover:to-purple-400 active:scale-95 transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-cyan-400/30 border border-cyan-400/30"
                                      style={{ fontFamily: 'Roboto Condensed, sans-serif' }}
                                    >
                                      Надеть
                                    </button>
                                  )
                                ) : (
                                  <button
                                    onClick={() => handlePurchase(item)}
                                    disabled={isPurchasing}
                                    className={`px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl font-semibold text-sm sm:text-base transition-all duration-300 ${
                                      isPurchasing
                                        ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-slate-300 cursor-not-allowed border border-slate-500/30'
                                        : 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400 active:scale-95 shadow-lg hover:shadow-2xl hover:shadow-emerald-400/40 border border-emerald-400/50 hover:border-emerald-300/70 shadow-[inset_0_2px_0_rgba(255,255,255,0.4)]'
                                    }`}
                                    style={{ fontFamily: 'Roboto Condensed, sans-serif' }}
                                  >
                                    {isPurchasing ? (
                                      <div className="flex flex-col items-center justify-center gap-1">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span className="text-xs">Покупка...</span>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-center gap-1">
                                        <span className="font-light">Купить</span>
                                        <div className="flex items-center gap-1">
                                          <span className="text-yellow-400 text-sm">⭐</span>
                                          <span className="text-sm font-bold text-white">{formatPrice(item.price)}</span>
                                        </div>
                                      </div>
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Coming Soon */}
                    <div 
                      className={`transform transition-all duration-500 ease-out ${
                        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
                      }`}
                      style={{ transitionDelay: `${shopItems.length * 100 + 200}ms` }}
                    >
                      <div className="relative bg-gradient-to-br from-slate-800/40 via-slate-700/20 to-slate-800/40 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-600/30 opacity-60">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <span className="text-2xl sm:text-3xl">🔒</span>
                              <h3 className="font-bold text-slate-400 text-lg sm:text-xl">Скоро...</h3>
                            </div>
                            <p className="text-sm sm:text-base text-slate-500">
                              Легендарный NFT предмет
                            </p>
                            <p className="text-xl sm:text-2xl font-bold text-slate-500">
                              ???
                            </p>
                          </div>
                          
                          <button
                            disabled
                            className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold bg-gradient-to-r from-slate-600 to-slate-700 text-slate-400 cursor-not-allowed border border-slate-500/30"
                          >
                            Недоступно
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
