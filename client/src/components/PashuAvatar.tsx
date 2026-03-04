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
            width: 'clamp(48px, 11vw, 72px)',
            height: 'clamp(48px, 11vw, 72px)',
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
        
        <div className="mt-1 text-[10px] sm:text-xs text-white font-light bg-black bg-opacity-50 px-2 py-1 rounded-lg whitespace-nowrap" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          {slot.name}
        </div>
      </div>
    );
  };

  // Группировка слотов по позициям (без верхнего ряда, чтобы не конфликтовать с хедером)
  const leftSlots = SLOT_POSITIONS.filter(slot => 
    slot.id === ItemType.CAP || slot.id === ItemType.RING || slot.id === ItemType.SHIRT || slot.id === ItemType.UNDERWEAR
  );

  const rightSlots = SLOT_POSITIONS.filter(slot => 
    slot.id === ItemType.GLASSES || slot.id === ItemType.NECKLACE || slot.id === ItemType.SOCKS || slot.id === ItemType.PANTS || slot.id === ItemType.SHOES
  );

  return (
    <div className="w-full h-full flex flex-col">
      {/* Основная область с фоном Паши и боковыми слотами */}
      <div 
        ref={captureRef}
        className="flex-1 min-h-0 flex items-center justify-between px-2 sm:px-4 relative"
        style={{
          backgroundImage: `url(${pashaAvatar})`,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Левая колонка */}
        <div className="flex flex-col gap-2 sm:gap-3 z-10">
          {leftSlots.map(renderSlot)}
        </div>
        
        {/* Центральная невидимая область для сохранения пропорций */}
        <div className="flex-1" />
        
        {/* Правая колонка */}
        <div className="flex flex-col gap-2 sm:gap-3 z-10">
          {rightSlots.map(renderSlot)}
        </div>
      </div>
    </div>
  );
};
