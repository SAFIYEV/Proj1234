import React from 'react';
import { User, ItemType } from '../types';
import { SLOT_POSITIONS } from '../utils/constants';
import { useItemsStore } from '../stores/useItemsStore';
import pashaAvatar from '../../assets/avatars/pasha-avatar_test.png';

interface PashuAvatarProps {
  user: User;
  onSlotClick: (type: ItemType) => void;
  captureRef?: React.RefObject<HTMLDivElement>;
}

export const PashuAvatar: React.FC<PashuAvatarProps> = ({ user, onSlotClick, captureRef }) => {
  const { setSelectedType } = useItemsStore();
  const OVERLAY_STYLES: Record<ItemType, React.CSSProperties> = {
    [ItemType.CAP]: { top: '9%', left: '50%', width: '22%', transform: 'translateX(-50%)' },
    [ItemType.GLASSES]: { top: '22%', left: '50%', width: '20%', transform: 'translateX(-50%)' },
    [ItemType.NECKLACE]: { top: '32%', left: '50%', width: '24%', transform: 'translateX(-50%)' },
    [ItemType.UNDERWEAR]: { top: '55%', left: '35%', width: '14%', transform: 'translateX(-50%)' },
    [ItemType.RING]: { top: '54%', left: '39%', width: '10%', transform: 'translateX(-50%)' },
    [ItemType.SOCKS]: { top: '85%', left: '50%', width: '19%', transform: 'translateX(-50%)' },
    [ItemType.SHIRT]: { top: '45%', left: '50%', width: '31%', transform: 'translateX(-50%)' },
    [ItemType.PANTS]: { top: '68%', left: '50%', width: '30%', transform: 'translateX(-50%)' },
    [ItemType.SHOES]: { top: '91%', left: '50%', width: '28%', transform: 'translateX(-50%)' },
  };
  const getTypeEmoji = (type: ItemType) => {
    if (type === ItemType.CAP) return '🧢';
    if (type === ItemType.GLASSES) return '👓';
    if (type === ItemType.NECKLACE) return '💎';
    if (type === ItemType.UNDERWEAR) return '⌚';
    if (type === ItemType.RING) return '💍';
    if (type === ItemType.SOCKS) return '🧦';
    if (type === ItemType.SHIRT) return '👕';
    if (type === ItemType.PANTS) return '👖';
    if (type === ItemType.SHOES) return '👟';
    return '🎭';
  };

  const handleSlotClick = (type: ItemType) => {
    setSelectedType(type);
    onSlotClick(type);
  };

  const getEquippedItem = (type: ItemType) => {
    return user.items.find(userItem => userItem.item.type === type && userItem.equipped);
  };

  const equippedItems = user.items.filter((userItem) => userItem.equipped);

  // Функция для рендера слота
  const renderSlot = (slot: any) => {
    const equippedUserItem = getEquippedItem(slot.id);
    const hasRenderableImage = !!equippedUserItem?.item.imageUrl && !equippedUserItem.item.imageUrl.includes('/images/');
    
    return (
      <div key={slot.id} className="flex flex-col items-center relative">
        <button
          onClick={() => handleSlotClick(slot.id)}
          className="border-2 bg-white bg-opacity-10 block rounded-2xl shadow-lg hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center"
          style={{
            width: 'clamp(56px, 14vw, 84px)',
            height: 'clamp(56px, 14vw, 84px)',
          }}
          
          title={slot.name}
        >
          {hasRenderableImage ? (
            <img
              src={equippedUserItem?.item.imageUrl}
              alt={slot.name}
              className="w-full h-full object-cover rounded-2xl"
            />
          ) : (
            <span className="text-gray-400 text-sm font-light">
              {getTypeEmoji(slot.id)}
            </span>
          )}
        </button>
        
        <div className="mt-2 text-xs text-white font-light bg-black bg-opacity-50 px-2 py-1 rounded-lg whitespace-nowrap" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          {slot.name}
        </div>
      </div>
    );
  };

  // Группировка слотов по позициям
  const topSlots = SLOT_POSITIONS.filter(slot => 
    slot.id === ItemType.CAP || slot.id === ItemType.GLASSES || slot.id === ItemType.NECKLACE
  );

  const leftSlots = SLOT_POSITIONS.filter(slot => 
    slot.id === ItemType.RING || slot.id === ItemType.SHIRT || slot.id === ItemType.UNDERWEAR
  );

  const rightSlots = SLOT_POSITIONS.filter(slot => 
    slot.id === ItemType.SOCKS || slot.id === ItemType.PANTS || slot.id === ItemType.SHOES
  );

  return (
    <div className="w-full h-full flex flex-col">
      {/* Верхний ряд из трёх слотов */}
      <div className="flex justify-center gap-2 sm:gap-4 py-2 sm:py-4">
        {topSlots.map(renderSlot)}
      </div>
      
      {/* Основная область с фоном Паши и боковыми слотами */}
      <div 
        className="flex-1 flex items-center justify-between px-2 sm:px-4 relative"
      >
        {/* Центр: сам Паша + реально надетые вещи */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            ref={captureRef}
            className="relative w-[min(64vw,360px)] h-[min(78vh,560px)]"
          >
            <img
              src={pashaAvatar}
              alt="Паша"
              className="w-full h-full object-contain"
            />
            {equippedItems.map((userItem) => {
              const imageUrl = userItem.item.imageUrl;
              if (!imageUrl) return null;
              const style = OVERLAY_STYLES[userItem.item.type];
              if (!style) return null;

              return (
                <img
                  key={userItem.id}
                  src={imageUrl}
                  alt={userItem.item.name}
                  className="absolute object-contain drop-shadow-[0_3px_6px_rgba(0,0,0,0.45)]"
                  style={style}
                />
              );
            })}
          </div>
        </div>

        {/* Левая колонка из трёх айтемов */}
        <div className="flex flex-col space-y-3 sm:space-y-4 z-10">
          {leftSlots.map(renderSlot)}
        </div>
        
        {/* Центральная невидимая область для сохранения пропорций */}
        <div className="flex-1" />
        
        {/* Правая колонка из трёх айтемов */}
        <div className="flex flex-col space-y-3 sm:space-y-4 z-10">
          {rightSlots.map(renderSlot)}
        </div>
      </div>
    </div>
  );
};
